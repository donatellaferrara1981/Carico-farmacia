'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getUoAttivaId } from '@/lib/uo-cookie';
import Anthropic from '@anthropic-ai/sdk';
import { inflateSync } from 'zlib';

interface PazienteEstratto {
  sala: string;
  numero_letto: number;
  nominativo: string;
}

function derivaPiano(sala: string): 'terra' | 'primo' | null {
  const s = sala.toUpperCase();
  if (s.includes('PIANO TERRA') || s.includes('TERRA')) return 'terra';
  if (s.includes('1 PIANO') || s.includes('PRIMO') || s.includes('1°') || s.includes('FIRST')) return 'primo';
  // Sale senza indicazione di piano: default primo (es. "Sala Lunga" è tipicamente al piano 1)
  return 'primo';
}

// ── Estrai pazienti da JPEG/PNG ──────────────────────────────────────────────

export async function estraiPazientiDaImmagineAction(
  fileBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  orgId: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: fileBase64 },
        },
        {
          type: 'text',
          text: `Sei un assistente per un reparto ospedaliero italiano. Questa immagine mostra la pagina "POSTI LETTO DEL REPARTO" del gestionale ospedaliero.

STRUTTURA DELLA PAGINA:
- Le STANZE/SALE hanno un'intestazione con sfondo blu (es. "STANZA GRANDE PIANO TERRA", "STANZA PICCOLA PIANO TERRA", "STANZA GRANDE 1 PIANO", "STANZA PICCOLA 1 PIANO", "Sala Lunga")
- Ogni letto occupa una cella con: "posto letto N" in alto, un badge "Misto", un'icona letto colorata, il NOME PAZIENTE in maiuscolo su 1-2 righe, il codice GSO sotto (formato GSO_XXXXXXXXXXXXXX)
- I letti VUOTI hanno solo l'icona grigia con un "+" — NON includere letti vuoti

ISTRUZIONI:
1. Scorri OGNI sezione da sinistra a destra, riga per riga
2. Per ogni letto OCCUPATO (ha nome paziente + codice GSO) estrai:
   - sala: nome esatto dall'intestazione blu della sezione
   - numero_letto: il numero dopo "posto letto" o "Posto Letto"
   - nominativo: nome completo in MAIUSCOLO (unisci le righe se il nome è su 2 righe, es. "DI MAURO" + "ANNA" → "DI MAURO ANNA")
3. Se il nome è troncato (finisce con ...) includi quello che vedi
4. Non saltare nessun paziente — controlla ogni cella

Rispondi SOLO con JSON array, nessun testo extra:
[{"sala":"STANZA GRANDE PIANO TERRA","numero_letto":1,"nominativo":"GAROFALO ROSARIO"},...]

Se nessun paziente: []`,
        },
      ],
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  let estratti: PazienteEstratto[];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    estratti = m ? JSON.parse(m[0]) : [];
  } catch {
    return { error: `Risposta non interpretabile: ${raw.slice(0, 200)}` };
  }

  if (!estratti.length) return { error: 'Nessun paziente riconosciuto nell\'immagine.' };

  // Cancella i pazienti precedenti per questa UO (aggiornamento completo)
  const delQuery = supabase.from('pazienti').delete().eq('org_id', orgId);
  if (uoAttivaId) delQuery.eq('unita_operativa_id', uoAttivaId);
  await delQuery;

  const nuovi = estratti.map((p) => ({
    org_id: orgId,
    unita_operativa_id: uoAttivaId ?? null,
    sala: p.sala,
    numero_letto: p.numero_letto,
    nominativo: p.nominativo,
    piano: derivaPiano(p.sala),
    data_aggiornamento: new Date().toISOString(),
  }));

  const { error: dbError } = await supabase.from('pazienti').insert(nuovi);
  if (dbError) return { error: dbError.message };

  revalidatePath('/pazienti');
  return { ok: true, count: nuovi.length };
}

// ── Stripping HTML → testo pulito ───────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parser diretto per il gestionale posti-letto IRCCS/MEG.
 * Strategia: usa i codici GSO come ancoraggio sicuro per i letti occupati.
 * GSO codes possono essere alfanumerici (es. GSO_2024XXXXXX o GSO_123456789).
 */
function parsePostiLettoHtml(html: string): PazienteEstratto[] {
  const testo = stripHtml(html);
  const risultati: PazienteEstratto[] = [];

  // Parole da escludere quando si cerca il nome paziente
  const ESCLUDI = new Set([
    'MISTO','MISTA','LETTO','POSTO','PIANO','STANZA','SALA','CARICO','REPARTO',
    'GRANDE','PICCOLA','TERRA','PRIMO','LUNGA','LUNGO','LARGO','LARGA','MISTO',
    'BADGE','ICONA','VUOTO','NOTE','DATA','TIPO','SESSO','ANNO','MESE','GIORNO',
  ]);

  // 1. Mappa posizione→nome sala usando intestazioni (sequenze ALL CAPS significative)
  //    Cerca blocchi che contengono almeno una parola tipica di sala
  const salaReg = /\b((?:[A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s]{2,})?(?:STANZA|SALA)\s+[A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s]*|[A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s]*(?:PIANO\s*TERRA|PIANO\s*\d|PIANO\s*PRIMO|\d\s*PIANO|\d°\s*PIANO)[A-ZÀÈÌÒÙ\s]*)/g;
  const salaMarkers: Array<{ pos: number; sala: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = salaReg.exec(testo)) !== null) {
    const nome = m[0].replace(/\s+/g, ' ').trim();
    if (nome.length >= 4) salaMarkers.push({ pos: m.index, sala: nome });
  }

  function salaAtPos(pos: number): string {
    let sala = 'REPARTO';
    for (const mk of salaMarkers) {
      if (mk.pos <= pos) sala = mk.sala;
      else break;
    }
    return sala;
  }

  // 2. Per ogni codice GSO (letto occupato), estrai letto+nome dal contesto precedente
  // GSO può essere: GSO_123456789 o GSO 123456789 (alfanumerico)
  const gsoReg = /\bGSO[_\s]([A-Z0-9]{6,})\b/gi;
  while ((m = gsoReg.exec(testo)) !== null) {
    const gsoPos = m.index;
    // Contesto: 600 caratteri prima del GSO
    const ctx = testo.slice(Math.max(0, gsoPos - 600), gsoPos);

    // Numero letto: "posto letto N" o "Posto Letto N"
    const lettoM = /posto\s+letto\s+(\d+)/i.exec(ctx);
    if (!lettoM) continue;
    const numeroLetto = parseInt(lettoM[1], 10);

    // Nome paziente: ultima sequenza ALL CAPS (2-4 parole, solo lettere/apostrofo)
    // dopo il match "posto letto N"
    const ctxDopoLetto = ctx.slice(lettoM.index + lettoM[0].length);
    const nomeReg = /\b([A-ZÀÈÌÒÙÄËÏÖÜ'][A-ZÀÈÌÒÙÄËÏÖÜ']{1,}(?:\s+[A-ZÀÈÌÒÙÄËÏÖÜ'][A-ZÀÈÌÒÙÄËÏÖÜ']{1,}){0,3})\b/g;
    let nomeM: RegExpExecArray | null;
    let ultimoNome = '';
    while ((nomeM = nomeReg.exec(ctxDopoLetto)) !== null) {
      const candidato = nomeM[1].trim();
      // Salta parole singole che sono keywords
      const parole = candidato.split(/\s+/);
      if (parole.length === 1 && ESCLUDI.has(candidato)) continue;
      // Salta se tutte le parole sono keywords
      if (parole.every(p => ESCLUDI.has(p))) continue;
      ultimoNome = candidato;
    }

    // Se non trovato dopo il numero letto, cerca nel contesto intero pre-GSO
    if (!ultimoNome) {
      const nomeReg2 = /\b([A-ZÀÈÌÒÙÄËÏÖÜ'][A-ZÀÈÌÒÙÄËÏÖÜ']{1,}(?:\s+[A-ZÀÈÌÒÙÄËÏÖÜ'][A-ZÀÈÌÒÙÄËÏÖÜ']{1,}){1,3})\b/g;
      while ((nomeM = nomeReg2.exec(ctx)) !== null) {
        const candidato = nomeM[1].trim();
        const parole = candidato.split(/\s+/);
        if (parole.every(p => ESCLUDI.has(p))) continue;
        ultimoNome = candidato;
      }
    }

    if (!ultimoNome) continue;

    risultati.push({
      sala: salaAtPos(gsoPos),
      numero_letto: numeroLetto,
      nominativo: ultimoNome,
    });
  }

  return risultati;
}

// ── Estrai pazienti da HTML ──────────────────────────────────────────────────

export async function estraiPazientiDaHtmlAction(
  htmlText: string,
  orgId: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  // 1. Prova parser diretto
  let estratti: PazienteEstratto[] = parsePostiLettoHtml(htmlText);

  // 2. Fallback Claude se il parser non trova abbastanza (< 3 pazienti)
  if (estratti.length < 3) {
    // Invia HTML raw (troncato) invece del testo stripped, per preservare più contesto
    const htmlTroncato = htmlText.slice(0, 80000);
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `Sei un assistente ospedaliero. Stai leggendo l'HTML della pagina "Posti Letto del Reparto" di un gestionale ospedaliero italiano (es. IRCCS).

La pagina mostra le stanze/sale del reparto (intestazioni in maiuscolo o con sfondo colorato), e per ogni sala i letti. Ogni letto occupato ha:
- "posto letto N" o "Posto Letto N" (numero del letto)
- Nome paziente in MAIUSCOLO (cognome e nome)
- Un codice GSO (formato GSO_XXXXXXX o simile)

I letti vuoti non hanno nome paziente né codice GSO.

Analizza l'HTML completo e restituisci SOLO un array JSON con TUTTI i pazienti trovati:
[{"sala":"NOME SALA ESATTO","numero_letto":1,"nominativo":"COGNOME NOME"}]

Se nessun paziente trovato: []

Non aggiungere altro testo, solo il JSON.

HTML:
${htmlTroncato}`,
      }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) estratti = JSON.parse(match[0]);
    } catch {
      return { error: `Risposta non interpretabile: ${raw.slice(0, 200)}` };
    }
  }

  if (!estratti.length) return { error: 'Nessun paziente riconosciuto nel file HTML. Prova a caricare uno screenshot (JPG/PNG) della pagina, oppure verifica che il file contenga codici GSO (formato GSO_XXXXXXXXX).' };

  const delQuery = supabase.from('pazienti').delete().eq('org_id', orgId);
  if (uoAttivaId) delQuery.eq('unita_operativa_id', uoAttivaId);
  await delQuery;

  const nuovi = estratti.map((p) => ({
    org_id: orgId,
    unita_operativa_id: uoAttivaId ?? null,
    sala: p.sala,
    numero_letto: p.numero_letto,
    nominativo: p.nominativo,
    piano: derivaPiano(p.sala),
    data_aggiornamento: new Date().toISOString(),
  }));

  const { error: dbError } = await supabase.from('pazienti').insert(nuovi);
  if (dbError) return { error: dbError.message };

  revalidatePath('/pazienti');
  return { ok: true, count: nuovi.length };
}

// ── Aggiorna singolo paziente ────────────────────────────────────────────────

export async function aggiornaPazienteAction(
  id: string,
  nominativo: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('pazienti').update({ nominativo }).eq('id', id);
  revalidatePath('/pazienti');
  return { ok: true };
}

// ── Elimina paziente ─────────────────────────────────────────────────────────

export async function eliminaPazienteAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('pazienti').delete().eq('id', id);
  revalidatePath('/pazienti');
  return { ok: true };
}

// ── Elimina tutti pazienti UO ────────────────────────────────────────────────

export async function eliminaTuttiPazientiUoAction(orgId: string, uoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('pazienti').delete().eq('org_id', orgId).eq('unita_operativa_id', uoId);
  revalidatePath('/pazienti');
  return { ok: true };
}

// ── Aggiungi paziente manuale ────────────────────────────────────────────────

export async function aggiungiPazienteAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();
  if (!member) return { error: 'Organizzazione non trovata.' };

  const sala = String(formData.get('sala') ?? '').trim();
  const codiceSdo = String(formData.get('codice_sdo') ?? '').trim() || null;
  const dataRicovero = String(formData.get('data_ricovero') ?? '').trim() || null;
  const { error } = await supabase.from('pazienti').insert({
    org_id: member.organization_id,
    unita_operativa_id: uoAttivaId ?? null,
    sala,
    numero_letto: parseInt(String(formData.get('numero_letto') ?? '0')),
    nominativo: String(formData.get('nominativo') ?? '').trim(),
    piano: derivaPiano(sala),
    codice_sdo: codiceSdo,
    data_ricovero: dataRicovero,
  });

  if (error) return { error: error.message };
  revalidatePath('/pazienti');
  return { ok: true };
}
