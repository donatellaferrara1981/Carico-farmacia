'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';
import { parseNutrizioniText } from '@/lib/parse-nutrizioni';
import { inflateSync } from 'zlib';
import { getUoAttivaId } from '@/lib/uo-cookie';
import Anthropic from '@anthropic-ai/sdk';

// Normalizza un nominativo per il confronto: maiuscolo, accenti/apostrofi via,
// spazi singoli, niente puntini di troncamento finali.
function normNome(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accenti
    .replace(/['’`.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Trova il paziente che corrisponde a una prescrizione (per letto+sala o per nome).
// Gestisce nomi troncati ("BRIGANDI AN...") e cognomi multi-parola ("DE CARO", "LA ROSA").
function trovaPaziente<T extends { id: string; nominativo: string; sala: string; numero_letto: number }>(
  pazienti: T[],
  nominativo: string | null,
  numeroLetto: number | null,
  sala: string | null,
): T | undefined {
  // 1. letto + sala (più affidabile, se disponibili)
  if (numeroLetto != null && sala) {
    const s = normNome(sala);
    const m = pazienti.find((p) => p.numero_letto === numeroLetto && normNome(p.sala) === s);
    if (m) return m;
  }
  if (!nominativo) return undefined;
  const target = normNome(nominativo).replace(/\.+$/, '').trim();
  if (!target) return undefined;

  // 2. uguaglianza esatta
  let m = pazienti.find((p) => normNome(p.nominativo) === target);
  if (m) return m;
  // 3. uno contiene l'altro (gestisce troncamenti tipo "BRIGANDI AN...")
  m = pazienti.find((p) => {
    const n = normNome(p.nominativo);
    return n.startsWith(target) || target.startsWith(n) || n.includes(target) || target.includes(n);
  });
  if (m) return m;
  // 4. confronto sulle prime due parole (cognome composto)
  const tk = target.split(' ');
  if (tk.length >= 2) {
    const cognome2 = `${tk[0]} ${tk[1]}`;
    m = pazienti.find((p) => normNome(p.nominativo).startsWith(cognome2));
    if (m) return m;
  }
  return undefined;
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\./g, '');
}

function estraiDaBlocchi(testo: string): string {
  const lines: string[] = [];
  const btBlocks = testo.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of btBlocks) {
    const re = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      const decoded = decodePdfString(m[1]);
      if (decoded.trim()) lines.push(decoded.trim());
    }
  }
  return lines.join('\n');
}

async function estraiTestoDaPdf(buffer: Buffer): Promise<string> {
  const raw = buffer.toString('binary');

  // Strategia 1: decomprime i stream FlateDecode (PDF clinici PHP/PDFium)
  const testoInflated: string[] = [];
  const streamRe = /<<([^>]*)>>\s*stream\r?\n([\s\S]*?)\nendstream/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const header = m[1];
    if (!header.includes('FlateDecode')) continue;
    try {
      const compressed = Buffer.from(m[2], 'binary');
      const decompressed = inflateSync(compressed).toString('latin1');
      const testo = estraiDaBlocchi(decompressed);
      if (testo.trim().length > 10) testoInflated.push(testo);
    } catch {
      // stream corrotto, salta
    }
  }
  if (testoInflated.length > 0) return testoInflated.join('\n');

  // Strategia 2: testo non compresso (BT/ET diretti nel raw)
  const testoGrezzo = estraiDaBlocchi(raw);
  if (testoGrezzo.trim().length > 10) return testoGrezzo;

  // Strategia 3: unpdf come ultimo tentativo
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    if (text && text.trim().length > 10) return text;
  } catch {
    // ignorato
  }

  return testoGrezzo;
}

export async function estraiProdottiDaPdfAction(
  documentoId: string,
  storagePath: string,
  orgId: string,
  categoria: string,
  isFirstInBatch = true,
) {
  try {
    return await _estraiProdottiDaPdfAction(documentoId, storagePath, orgId, categoria, isFirstInBatch);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Errore interno: ${msg}` };
  }
}

async function _estraiProdottiDaPdfAction(
  documentoId: string,
  storagePath: string,
  orgId: string,
  categoria: string,
  isFirstInBatch: boolean,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  // Legge la sala associata al documento
  const { data: docMeta } = await supabase
    .from('documenti')
    .select('sala')
    .eq('id', documentoId)
    .single();
  const sala: string | null = docMeta?.sala ?? null;

  const { data: fileData, error: dlError } = await supabase.storage
    .from('documenti')
    .download(storagePath);
  if (dlError || !fileData) return { error: 'Impossibile scaricare il file.' };

  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Per nutrizioni: usa Claude direttamente sul PDF (struttura tabellare complessa)
  // Per terapie/sanitario: estrai testo e usa parser regex
  if (categoria === 'nutrizioni') {
    const base64Pdf = buffer.toString('base64');
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
          },
          {
            type: 'text',
            text: `Estrai le prescrizioni nutrizionali da questo PDF ospedaliero italiano. La tabella ha colonne: dati paziente (COGNOME NOME, letto, sala) | nome prodotto nutrizionale | numero unità | indicazione clinica (ignora).

Regole:
- Nome prodotto valido = marchio nutrizionale (Nutrison, Diason, Isosource, Ensure, Fresubin, Acqua gel, Fortimel, ecc.)
- NON sono prodotti: "Fl vol. 500ml", "Fl (220ml/h)", indicazioni cliniche
- Somma le unità per prodotto nell'array "prodotti"
- Elenca ogni riga paziente nell'array "prescrizioni"
- tipo: "flacone" per liquidi, "vasetto" per acqua gel/creme/budini

Normalizzazione nomi (usa SEMPRE il nome canonico a sinistra):
- "Diason" → qualsiasi variante che contiene "Diason" (Nutrison Advanced Diason, Diason 500ml, ecc.) → "Diason" + dosaggio (es. "Diason 500ml")
- "Nutrison" → varianti senza "Diason" (Nutrison Energy, Nutrison Advanced, ecc.) → "Nutrison" + dosaggio
- "Acqua gel" → qualsiasi variante (Acqua gelificata, Acqua Gel, AcquaGel, Gel d'acqua, ecc.) → "Acqua gel" + dosaggio (es. "Acqua gel 125g")
- In generale: se due nomi si riferiscono chiaramente allo stesso prodotto, usa il nome più breve e riconoscibile

OUTPUT: rispondi ESCLUSIVAMENTE con il JSON seguente, zero testo aggiuntivo prima o dopo:
{
  "prodotti": [
    {"nome":"Nutrison 500ml","quantita":7,"tipo":"flacone"},
    {"nome":"Acqua gel 125g","quantita":3,"tipo":"vasetto"}
  ],
  "prescrizioni": [
    {"nominativo":"ROSSI MARIO","sala":"STANZA GRANDE PIANO TERRA","numero_letto":1,"prodotto":"Nutrison 500ml","quantita":2,"tipo":"flacone"},
    {"nominativo":"BIANCHI ANNA","sala":"STANZA PICCOLA PIANO TERRA","numero_letto":3,"prodotto":"Acqua gel 125g","quantita":3,"tipo":"vasetto"}
  ]
}

Se nessun prodotto: {"prodotti":[],"prescrizioni":[]}`,
          },
        ],
      }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    let estratti: import('@/lib/parse-terapia').ProdottoEstratto[] = [];
    type Prescrizione = { nominativo: string; sala: string; numero_letto: number; prodotto: string; quantita: number; tipo: string };
    let prescrizioni: Prescrizione[] = [];

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const items: { nome: string; quantita?: number; tipo: string }[] = parsed.prodotti ?? [];
        prescrizioni = parsed.prescrizioni ?? [];

        const formaMap: Record<string, import('@/lib/prodotti').FormaFarmaceutica> = {
          flacone: 'flacone_infusione',
          vasetto: 'vasetto',
          bustina: 'sciroppo',
          altro: 'flacone_infusione',
        };
        estratti = items
          .filter((i) => i.nome && i.nome.length > 1)
          .map((i) => ({
            principio_attivo: i.nome,
            nome_commerciale: '',
            forma_farmaceutica: formaMap[i.tipo] ?? 'flacone_infusione',
            dosaggio: i.tipo === 'vasetto' ? 'vasetto' : '',
            consumo_giornaliero: typeof i.quantita === 'number' && i.quantita > 0 ? i.quantita : 1,
            note: '',
          }));
      }
    } catch {
      return { error: `Risposta Claude non interpretabile: ${raw.slice(0, 200)}` };
    }

    if (!estratti.length) {
      return { error: 'Nessun prodotto nutrizionale riconosciuto nel PDF.' };
    }

    // 1. Salva / aggiorna totali prodotti
    // Se è il primo PDF del batch, azzera i conteggi esistenti (fresh start)
    if (isFirstInBatch) {
      await supabase.from('prodotti')
        .update({ consumo_giornaliero: 0 })
        .eq('org_id', orgId)
        .eq('categoria', categoria);
    }

    const { data: esistenti } = await supabase
      .from('prodotti')
      .select('id, principio_attivo, forma_farmaceutica, dosaggio, consumo_giornaliero, nome_commerciale')
      .eq('org_id', orgId)
      .eq('categoria', categoria);

    const normalizza = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const nuovi = [];
    let aggiornati = 0;

    for (const p of estratti) {
      const match = (esistenti ?? []).find(
        (e) =>
          normalizza(e.principio_attivo) === normalizza(p.principio_attivo) &&
          e.forma_farmaceutica === p.forma_farmaceutica,
      );
      if (match) {
        // Nutrizioni: somma i fl dei vari PDF (notte + pom + mattina)
        await supabase.from('prodotti').update({ consumo_giornaliero: (match.consumo_giornaliero ?? 0) + p.consumo_giornaliero }).eq('id', match.id);
        aggiornati++;
      } else {
        nuovi.push({
          org_id: orgId,
          categoria,
          principio_attivo: p.principio_attivo,
          nome_commerciale: null,
          forma_farmaceutica: p.forma_farmaceutica,
          dosaggio: p.dosaggio || null,
          quantita: 0,
          consumo_giornaliero: p.consumo_giornaliero,
          note: null,
          ...(sala ? { sala } : {}),
          ...(uoAttivaId ? { unita_operativa_id: uoAttivaId } : {}),
        });
      }
    }
    if (nuovi.length > 0) {
      const { error: dbError } = await supabase.from('prodotti').insert(nuovi);
      if (dbError) return { error: dbError.message };
    }

    // 2. Salva prescrizioni per paziente in terapie_pazienti (tipo='nutrizione')
    if (prescrizioni.length > 0) {
      // Carica pazienti esistenti per matchare sala+letto
      const { data: pazienti } = await supabase
        .from('pazienti')
        .select('id, nominativo, sala, numero_letto')
        .eq('org_id', orgId);

      // Rimuovi le nutrizioni precedenti SOLO al primo PDF del batch,
      // così i 3 turni (mattina/pomeriggio/notte) si accumulano invece di sovrascriversi.
      if (isFirstInBatch) {
        await supabase.from('terapie_pazienti').delete().eq('org_id', orgId).eq('tipo', 'nutrizione');
      }

      const nuovePrescrizioni = [];
      for (const pr of prescrizioni) {
        const paziente = trovaPaziente(pazienti ?? [], pr.nominativo, pr.numero_letto, pr.sala);
        if (!paziente) continue;

        nuovePrescrizioni.push({
          org_id: orgId,
          paziente_id: paziente.id,
          principio_attivo: pr.prodotto,
          dosaggio: pr.tipo === 'vasetto' ? 'vasetto' : null,
          posologia: `${pr.quantita} ${pr.tipo === 'vasetto' ? 'vasetti' : 'fl'}/die`,
          tipo: 'nutrizione',
        });
      }

      if (nuovePrescrizioni.length > 0) {
        await supabase.from('terapie_pazienti').insert(nuovePrescrizioni);
      }
    }

    revalidatePath(`/${categoria}`);
    revalidatePath('/pazienti');
    return { ok: true, count: nuovi.length, aggiornati };
  }

  // Sanitario: usa Claude per leggere liste di materiale ospedaliero
  if (categoria === 'sanitario') {
    const base64Pdf = buffer.toString('base64');
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
          },
          {
            type: 'text',
            text: `Sei un assistente per una farmacia ospedaliera italiana. Questo PDF contiene una lista di materiale sanitario (presidi, dispositivi medici, guanti, cateteri, garze, ecc.).

Estrai ogni articolo presente nella lista. Per ogni articolo restituisci:
- "nome": nome completo del prodotto (stringa, così come appare nella lista)
- "codice": codice/cod. del prodotto se presente, altrimenti null
- "quantita": quantità se indicata numericamente, altrimenti 1

Rispondi SOLO con JSON (nessun testo extra):
{"articoli":[
  {"nome":"AGHI A FARFALLA 21G DA 19 A 20 MM","codice":"2100324021","quantita":1},
  {"nome":"GARZA IDROFILA 20x20 10G","codice":"12400620220","quantita":1}
]}

Se nessun articolo trovato: {"articoli":[]}`,
          },
        ],
      }],
    });

    const rawMsg = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    let articoli: Array<{ nome: string; codice: string | null; quantita: number }> = [];
    try {
      const match = rawMsg.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        articoli = parsed.articoli ?? [];
      }
    } catch {
      return { error: `Risposta Claude non interpretabile: ${rawMsg.slice(0, 200)}` };
    }

    if (!articoli.length) return { error: 'Nessun articolo sanitario riconosciuto nel PDF.' };

    const { data: esistenti } = await supabase
      .from('prodotti')
      .select('id, principio_attivo, nome_commerciale')
      .eq('org_id', orgId)
      .eq('categoria', 'sanitario');

    const normalizza = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const nuovi = [];
    let aggiornati = 0;

    for (const art of articoli) {
      const match = (esistenti ?? []).find(
        (e) => normalizza(e.principio_attivo) === normalizza(art.nome)
      );
      if (match) {
        aggiornati++;
      } else {
        nuovi.push({
          org_id: orgId,
          categoria: 'sanitario',
          principio_attivo: art.nome,
          nome_commerciale: art.codice ? `cod. ${art.codice}` : null,
          forma_farmaceutica: 'altro' as const,
          dosaggio: null,
          quantita: 0,
          consumo_giornaliero: 0,
          note: null,
          // sanitario: prodotti condivisi a livello org (no UO)
        });
      }
    }

    if (nuovi.length > 0) {
      const { error: dbError } = await supabase.from('prodotti').insert(nuovi);
      if (dbError) return { error: dbError.message };
    }

    revalidatePath('/sanitario');
    return { ok: true, count: nuovi.length, aggiornati };
  }

  // Terapie: estrai testo e usa parser regex
  const testo = await estraiTestoDaPdf(buffer);

  if (!testo.trim()) {
    return { error: 'Nessun testo leggibile nel PDF. Il file potrebbe essere una scansione immagine.' };
  }

  // Per terapie: usa Claude per estrarre farmaci per paziente (supporto multi-paziente)
  type PrescrizioneTerapia = {
    nominativo: string;
    numero_letto: number | null;
    sala: string | null;
    farmaci: Array<{
      principio_attivo: string;
      nome_commerciale: string | null;
      forma_farmaceutica: string;
      dosaggio: string | null;
      consumo_giornaliero: number;
      posologia: string | null;
      note: string | null;
    }>;
  };

  let estratti: import('@/lib/parse-terapia').ProdottoEstratto[];
  let prescrizioniPerPaziente: PrescrizioneTerapia[] = [];

  if (categoria === 'terapie') {
    const base64Pdf = buffer.toString('base64');
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
          },
          {
            type: 'text',
            text: `Sei un assistente per una farmacia ospedaliera italiana. Analizza questo PDF di terapia ospedaliera.

Il PDF può contenere le terapie di UNO o PIÙ pazienti (foglio di reparto).

FORMATI SUPPORTATI:

Formato A (classico): foglio terapia con intestazione paziente + tabella farmaci con posologia testuale (es. "1cp x 3/die", "ogni 8 ore").

Formato B (griglia con punti/cerchi): il nome del paziente è in CIMA al documento. I farmaci sono nella COLONNA SINISTRA con dosaggio. A destra c'è una GRIGLIA con punti/cerchi (●) che indicano i momenti di somministrazione giornalieri.
- Conta i punti (●) nella riga di ciascun farmaco per determinare le somministrazioni/die
- 1 punto = 1 volta/die, 2 punti = 2 volte/die, 3 punti = 3 volte/die, ecc.
- Il numero di punti = consumo_giornaliero
- Usa il numero di punti anche per costruire la posologia (es. 1 punto = "1 volta/die", 2 punti = "2 volte/die")

Per ogni paziente trovato restituisci un oggetto in "pazienti":
- nominativo: "COGNOME NOME" (maiuscolo come nel documento)
- numero_letto: number | null
- sala: string | null (es. "Stanza", "Stanza Isolamento")
- farmaci: array di farmaci prescritti a quel paziente

Per ogni farmaco:
- principio_attivo: string (nome principio attivo in italiano, maiuscolo iniziale)
- nome_commerciale: string | null
- forma_farmaceutica: "compressa","capsula","fiala","flacone","bustina","cerotto","supposte","sciroppo","crema","collirio","altro"
- dosaggio: string | null (es. "500 mg")
- consumo_giornaliero: number (unità totali/die, default 1 — nel formato A conta le somministrazioni; nel formato B conta i punti ●)
- posologia: string | null (descrizione frequenza somministrazione, es. "1cp mattina e sera", "2fl/die", "ogni 8 ore")
- note: string | null

Rispondi SOLO con JSON valido:
{
  "pazienti": [
    {
      "nominativo": "ROSSI MARIO",
      "numero_letto": 1,
      "sala": "Stanza",
      "farmaci": [
        {"principio_attivo":"Baclofene","nome_commerciale":null,"forma_farmaceutica":"compressa","dosaggio":"25 mg","consumo_giornaliero":3,"posologia":"1cp x 3 volte/die","note":null}
      ]
    }
  ]
}

Se nessun paziente/farmaco: {"pazienti": []}`,
          },
        ],
      }],
    });

    const rawMsg = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    try {
      const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        prescrizioniPerPaziente = parsed.pazienti ?? [];
        // Raccoglie tutti i farmaci unici per il catalogo prodotti
        const tuttiIFarmaci = prescrizioniPerPaziente.flatMap((p) => p.farmaci);
        estratti = tuttiIFarmaci as import('@/lib/parse-terapia').ProdottoEstratto[];
      } else {
        estratti = [];
      }
    } catch {
      estratti = parseTerapiaText(testo);
    }
  } else {
    estratti = parseTerapiaText(testo);
  }

  if (!estratti.length) {
    const anteprima = testo.slice(0, 300).replace(/\n+/g, ' ↵ ');
    return { error: `Testo estratto ma nessun farmaco riconosciuto.\n\nAnteprima: "${anteprima}"` };
  }

  // Al primo PDF del batch azzera i consumi terapie e svuota i collegamenti
  // paziente→terapia, così ricaricare i 3 turni riparte pulito senza duplicare.
  if (categoria === 'terapie' && isFirstInBatch) {
    await supabase.from('prodotti')
      .update({ consumo_giornaliero: 0 })
      .eq('org_id', orgId)
      .eq('categoria', 'terapie');
    await supabase.from('terapie_pazienti')
      .delete()
      .eq('org_id', orgId)
      .eq('tipo', 'terapia');
  }

  // Prodotti org-wide: nessun filtro UO per terapie/nutrizioni
  const { data: esistenti } = await supabase
    .from('prodotti')
    .select('id, principio_attivo, forma_farmaceutica, dosaggio, consumo_giornaliero, nome_commerciale')
    .eq('org_id', orgId)
    .eq('categoria', categoria);

  const normalizza = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const nuovi: Array<{ id?: string; org_id: string; categoria: string; principio_attivo: string; nome_commerciale: string | null; forma_farmaceutica: string; dosaggio: string | null; quantita: number; consumo_giornaliero: number; note: string | null; sala?: string }> = [];
  const aggiornatiIds: string[] = [];
  let aggiornati = 0;

  for (const p of estratti) {
    // Cerca un prodotto esistente con stesso principio attivo + forma + dosaggio (case-insensitive)
    const match = (esistenti ?? []).find(
      (e) =>
        normalizza(e.principio_attivo) === normalizza(p.principio_attivo) &&
        e.forma_farmaceutica === p.forma_farmaceutica &&
        normalizza(e.dosaggio ?? '') === normalizza(p.dosaggio ?? ''),
    );

    if (match) {
      // Per nutrizioni: sostituisce il consumo (= conteggio prescrizioni dal PDF)
      // Per terapie: incrementa (somma visite successive)
      const nuovoConsumo = categoria === 'nutrizioni'
        ? p.consumo_giornaliero
        : (match.consumo_giornaliero ?? 1) + p.consumo_giornaliero;
      await supabase
        .from('prodotti')
        .update({
          consumo_giornaliero: nuovoConsumo,
          ...(p.nome_commerciale && !match.nome_commerciale ? { nome_commerciale: p.nome_commerciale } : {}),
        })
        .eq('id', match.id);
      aggiornatiIds.push(match.id);
      aggiornati++;
    } else {
      nuovi.push({
        org_id: orgId,
        categoria,
        principio_attivo: p.principio_attivo,
        nome_commerciale: p.nome_commerciale || null,
        forma_farmaceutica: p.forma_farmaceutica,
        dosaggio: p.dosaggio || null,
        quantita: 0,
        consumo_giornaliero: p.consumo_giornaliero,
        note: p.note || null,
        ...(sala ? { sala } : {}),
      });
    }
  }

  let inseriti: Array<{ id: string; principio_attivo: string; dosaggio: string | null }> = [];
  if (nuovi.length > 0) {
    const { data: insertedData, error: dbError } = await supabase
      .from('prodotti')
      .upsert(nuovi, { onConflict: 'org_id,categoria,principio_attivo_norm,dosaggio_norm,forma_farmaceutica', ignoreDuplicates: true })
      .select('id, principio_attivo, dosaggio');
    if (dbError) return { error: dbError.message };
    inseriti = insertedData ?? [];
  }

  // Collega farmaci ai pazienti (multi-paziente)
  if (categoria === 'terapie' && prescrizioniPerPaziente.length > 0) {
    const { data: pazientiDb } = await supabase
      .from('pazienti')
      .select('id, nominativo, sala, numero_letto')
      .eq('org_id', orgId);

    const { data: prodottiDb } = await supabase
      .from('prodotti')
      .select('id, principio_attivo, dosaggio, forma_farmaceutica')
      .eq('org_id', orgId)
      .eq('categoria', 'terapie');

    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const nuoveTP: Array<{
      org_id: string; paziente_id: string; prodotto_id: string | null;
      principio_attivo: string; dosaggio: string | null; posologia: string | null; tipo: string;
    }> = [];

    // Collegamenti già presenti (dai PDF dei turni precedenti) per evitare duplicati
    const { data: tpEsistenti } = await supabase
      .from('terapie_pazienti')
      .select('paziente_id, principio_attivo, dosaggio, posologia')
      .eq('org_id', orgId)
      .eq('tipo', 'terapia');
    const chiave = (pid: string, pa: string, dos: string | null, pos: string | null) =>
      `${pid}|${norm(pa)}|${norm(dos ?? '')}|${norm(pos ?? '')}`;
    const viste = new Set((tpEsistenti ?? []).map((t) => chiave(t.paziente_id, t.principio_attivo, t.dosaggio, t.posologia)));

    for (const presc of prescrizioniPerPaziente) {
      const paziente = trovaPaziente(pazientiDb ?? [], presc.nominativo, presc.numero_letto, presc.sala);
      if (!paziente) continue;

      for (const f of presc.farmaci) {
        const k = chiave(paziente.id, f.principio_attivo, f.dosaggio, f.posologia ?? null);
        if (viste.has(k)) continue; // stesso farmaco/turno già collegato
        viste.add(k);

        const prod = (prodottiDb ?? []).find(
          (p) => norm(p.principio_attivo) === norm(f.principio_attivo) &&
            norm(p.dosaggio ?? '') === norm(f.dosaggio ?? '')
        );
        nuoveTP.push({
          org_id: orgId,
          paziente_id: paziente.id,
          prodotto_id: prod?.id ?? null,
          principio_attivo: f.principio_attivo,
          dosaggio: f.dosaggio,
          posologia: f.posologia ?? null,
          tipo: 'terapia',
        });
      }
    }

    if (nuoveTP.length > 0) {
      await supabase.from('terapie_pazienti').insert(nuoveTP);
    }
  }

  revalidatePath(`/${categoria}`);
  return { ok: true, count: nuovi.length, aggiornati };
}

export async function estraiProdottiDaImmagineAction(
  documentoId: string,
  storagePath: string,
  orgId: string,
  categoria: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  const { data: docMeta } = await supabase
    .from('documenti')
    .select('sala, nome_file')
    .eq('id', documentoId)
    .single();
  const sala: string | null = docMeta?.sala ?? null;
  const nomeFile: string = docMeta?.nome_file ?? '';

  const { data: fileData, error: dlError } = await supabase.storage
    .from('documenti')
    .download(storagePath);
  if (dlError || !fileData) return { error: 'Impossibile scaricare l\'immagine.' };

  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  // Determina media type dall'estensione
  const ext = nomeFile.split('.').pop()?.toLowerCase() ?? 'jpeg';
  const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: categoria === 'sanitario'
            ? `Questa immagine è una foto di una lista stampata intitolata "Materiale Sanitario" di un reparto ospedaliero italiano.

La lista è una tabella con righe di prodotti. Ogni riga contiene:
- Il nome del prodotto (in MAIUSCOLO, es. "AGHI A FARFALLA 21G DA 19 A 20 MM")
- Spesso un codice numerico alla fine (es. "COD 2100324021" o "cod. 2100324021" o solo il numero)
- Alcune righe hanno una X manoscritta sul lato sinistro (includile comunque)
- Alcune righe hanno numeri o note manoscritte nei margini (ignorali)

Il tuo compito: leggi OGNI riga della lista e restituisci un array JSON con tutti gli articoli trovati.

Per ogni articolo:
{
  "principio_attivo": "NOME COMPLETO DEL PRODOTTO IN MAIUSCOLO",
  "nome_commerciale": "cod. XXXXXX" oppure null se non c'è codice,
  "forma_farmaceutica": "altro",
  "dosaggio": null,
  "consumo_giornaliero": 1,
  "note": null
}

IMPORTANTE: includi TUTTI gli articoli della pagina, anche se sono molti. Non saltarne nessuno.

Rispondi ESCLUSIVAMENTE con l'array JSON, zero testo prima o dopo:
[{"principio_attivo":"AGHI A FARFALLA 21G DA 19 A 20 MM","nome_commerciale":"cod. 2100324021","forma_farmaceutica":"altro","dosaggio":null,"consumo_giornaliero":1,"note":null}]`
            : `Sei un assistente per una farmacia ospedaliera italiana. Analizza questa immagine (lista terapie, richiesta farmaci, foglio paziente, ecc.) ed estrai tutti i farmaci presenti.

Per ogni farmaco restituisci SOLO un oggetto JSON nell'array:
- principio_attivo: string (nome del principio attivo, in italiano, maiuscolo iniziale)
- nome_commerciale: string | null
- forma_farmaceutica: una di: "compressa","capsula","fiala","flacone","bustina","cerotto","supposte","sciroppo","crema","collirio","altro"
- dosaggio: string | null (es. "500 mg", "1 g/100 ml")
- consumo_giornaliero: number (unità al giorno, default 1)
- note: string | null

Rispondi SOLO con array JSON valido, senza testo aggiuntivo. Esempio:
[{"principio_attivo":"Amoxicillina","nome_commerciale":"Augmentin","forma_farmaceutica":"compressa","dosaggio":"875 mg","consumo_giornaliero":2,"note":null}]

Se nessun farmaco: []`,
        },
      ],
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  let estratti: Array<{
    principio_attivo: string;
    nome_commerciale: string | null;
    forma_farmaceutica: string;
    dosaggio: string | null;
    consumo_giornaliero: number;
    note: string | null;
  }>;

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    estratti = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return { error: `Risposta non interpretabile: ${raw.slice(0, 200)}` };
  }

  if (!estratti.length) return { error: `Nessun articolo riconosciuto. Risposta Claude: "${raw.slice(0, 150)}"` };

  const esistentiQuery = supabase
    .from('prodotti')
    .select('id, principio_attivo, forma_farmaceutica, dosaggio, consumo_giornaliero, nome_commerciale')
    .eq('org_id', orgId)
    .eq('categoria', categoria);
  // Per sanitario i prodotti sono org-wide (no filtro UO)
  if (categoria !== 'sanitario') {
    if (sala) esistentiQuery.eq('sala', sala);
    if (uoAttivaId) esistentiQuery.eq('unita_operativa_id', uoAttivaId);
  }
  const { data: esistenti } = await esistentiQuery;

  const normalizza = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const nuovi = [];
  let aggiornati = 0;

  for (const p of estratti) {
    const match = (esistenti ?? []).find(
      (e) =>
        normalizza(e.principio_attivo) === normalizza(p.principio_attivo) &&
        e.forma_farmaceutica === p.forma_farmaceutica &&
        normalizza(e.dosaggio ?? '') === normalizza(p.dosaggio ?? ''),
    );
    if (match) {
      if (categoria !== 'sanitario') {
        await supabase.from('prodotti').update({
          consumo_giornaliero: (match.consumo_giornaliero ?? 1) + p.consumo_giornaliero,
          ...(p.nome_commerciale && !match.nome_commerciale ? { nome_commerciale: p.nome_commerciale } : {}),
        }).eq('id', match.id);
      }
      aggiornati++;
    } else {
      nuovi.push({
        org_id: orgId,
        categoria,
        principio_attivo: p.principio_attivo,
        nome_commerciale: p.nome_commerciale || null,
        forma_farmaceutica: p.forma_farmaceutica,
        dosaggio: p.dosaggio || null,
        quantita: 0,
        consumo_giornaliero: categoria === 'sanitario' ? 0 : p.consumo_giornaliero,
        note: p.note || null,
        // sanitario: org-wide, no UO
        ...(categoria !== 'sanitario' && sala ? { sala } : {}),
        ...(categoria !== 'sanitario' && uoAttivaId ? { unita_operativa_id: uoAttivaId } : {}),
      });
    }
  }

  if (nuovi.length > 0) {
    const { error: dbError } = await supabase.from('prodotti').insert(nuovi);
    if (dbError) return { error: dbError.message };
  }

  revalidatePath(`/${categoria}`);
  return { ok: true, count: nuovi.length, aggiornati };
}
