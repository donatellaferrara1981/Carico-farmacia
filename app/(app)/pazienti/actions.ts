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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: fileBase64 },
        },
        {
          type: 'text',
          text: `Sei un assistente per una struttura ospedaliera italiana. Analizza questa immagine che mostra la mappa dei posti letto suddivisi in sale/stanze.

Estrai TUTTI i pazienti presenti (letti occupati). Per i letti vuoti NON includere nulla.

Per ogni paziente restituisci un oggetto con:
- sala: string (nome esatto della sala/stanza come appare nell'intestazione, es. "GCA1", "GCA3", "STANZA GRANDE 1 PIANO", "STANZA PICCOLA 1 PIANO", "Sala Lunga")
- numero_letto: number (numero del letto)
- nominativo: string (nome e cognome del paziente, maiuscolo come appare)

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo. Esempio:
[{"sala":"GCA1","numero_letto":1,"nominativo":"ROSSI MARIO"},{"sala":"GCA3","numero_letto":5,"nominativo":"BIANCHI ANNA"}]

Se non trovi pazienti: []`,
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
 * Cerca: intestazioni sala → "posto letto N" → nome paziente (ALL CAPS) → GSO code.
 * I letti vuoti non hanno GSO code: vengono ignorati.
 */
function parsePostiLettoHtml(html: string): PazienteEstratto[] {
  const testo = stripHtml(html);
  const risultati: PazienteEstratto[] = [];

  // Segmenta per sala: cerca intestazioni di sezione in maiuscolo
  // Pattern: parole come "STANZA", "SALA", "PIANO", seguite da altri token maiuscoli
  // Usiamo i GSO code come ancora: GSO_YYYYNNNNNNNNN
  // Intorno a ogni GSO recuperiamo il nome (maiuscolo) e il numero letto

  // 1. Trova tutte le posizioni dei GSO
  const gsoReg = /GSO[_\s](\d{10,})/gi;
  // 2. Identifica intestazioni sala: blocchi ALL CAPS ≥ 3 parole
  const salaReg = /\b([A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s]{3,}(?:PIANO\s*TERRA|PIANO|\d°?\s*PIANO|LARGA|LUNGA|GRANDE|PICCOLA|LUNG[AO])[A-ZÀÈÌÒÙ\s]*)\b/g;

  // Costruiamo una mappa posizione→sala dalla serie di match
  const salaMarkers: Array<{ pos: number; sala: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = salaReg.exec(testo)) !== null) {
    const nome = m[0].replace(/\s+/g, ' ').trim();
    if (nome.length > 3) salaMarkers.push({ pos: m.index, sala: nome });
  }

  function salaAtPos(pos: number): string {
    let sala = 'REPARTO';
    for (const mk of salaMarkers) {
      if (mk.pos <= pos) sala = mk.sala;
    }
    return sala;
  }

  // Per ogni GSO recupera il contesto precedente (500 char) per trovare letto e nome
  while ((m = gsoReg.exec(testo)) !== null) {
    const gsoPos = m.index;
    const ctx = testo.slice(Math.max(0, gsoPos - 500), gsoPos);

    // Numero letto: "posto letto N" (case-insensitive)
    const lettoM = /posto\s+letto\s+(\d+)/i.exec(ctx);
    if (!lettoM) continue;
    const numeroLetto = parseInt(lettoM[1], 10);

    // Nome paziente: blocco ALL CAPS (2-4 parole, no numeri) più recente nel contesto
    const nomeReg = /\b([A-ZÀÈÌÒÙÄËÏÖÜ']{2,}(?:\s+[A-ZÀÈÌÒÙÄËÏÖÜ']{2,}){1,3})\b/g;
    let nomeM: RegExpExecArray | null;
    let ultimoNome = '';
    while ((nomeM = nomeReg.exec(ctx)) !== null) {
      const candidato = nomeM[1].trim();
      // Esclude parole di sistema / UI
      if (/^(MISTO|MISTA|LETTO|POSTO|PIANO|STANZA|SALA|CARICO|REPARTO|GRANDE|PICCOLA|TERRA|PRIMO|LUNGA|LARGO)$/.test(candidato)) continue;
      ultimoNome = candidato;
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
    const testoStrippato = stripHtml(htmlText).slice(0, 40000);
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Sei un assistente ospedaliero. Questo testo è estratto da una pagina HTML del gestionale posti letto di un reparto ospedaliero italiano.

Il formato tipico è: nome stanza/sala (in maiuscolo), poi "posto letto N", poi nome paziente in MAIUSCOLO (cognome nome), poi un codice GSO.
I letti vuoti NON hanno nome paziente né codice GSO.

Estrai TUTTI i pazienti ricoverati. Restituisci SOLO un array JSON:
[{"sala":"NOME SALA","numero_letto":1,"nominativo":"COGNOME NOME"}]

Se nessun paziente: []

TESTO:
${testoStrippato}`,
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

  if (!estratti.length) return { error: 'Nessun paziente riconosciuto. Prova a caricare uno screenshot (JPG/PNG) della pagina.' };

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
  const { error } = await supabase.from('pazienti').insert({
    org_id: member.organization_id,
    unita_operativa_id: uoAttivaId ?? null,
    sala,
    numero_letto: parseInt(String(formData.get('numero_letto') ?? '0')),
    nominativo: String(formData.get('nominativo') ?? '').trim(),
    piano: derivaPiano(sala),
  });

  if (error) return { error: error.message };
  revalidatePath('/pazienti');
  return { ok: true };
}
