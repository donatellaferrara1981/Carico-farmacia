'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';
import { parseNutrizioniText } from '@/lib/parse-nutrizioni';
import { inflateSync } from 'zlib';
import { getUoAttivaId } from '@/lib/uo-cookie';
import Anthropic from '@anthropic-ai/sdk';

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

  const testo = await estraiTestoDaPdf(buffer);

  if (!testo.trim()) {
    return { error: 'Nessun testo leggibile nel PDF. Il file potrebbe essere una scansione immagine.' };
  }

  const estratti = categoria === 'nutrizioni'
    ? parseNutrizioniText(testo)
    : parseTerapiaText(testo);
  if (!estratti.length) {
    const anteprima = testo.slice(0, 300).replace(/\n+/g, ' ↵ ');
    return { error: `Testo estratto ma nessun farmaco riconosciuto.\n\nAnteprima: "${anteprima}"` };
  }

  // Carica i prodotti già presenti per questo org+categoria+sala+UO
  const esistentiQuery = supabase
    .from('prodotti')
    .select('id, principio_attivo, forma_farmaceutica, dosaggio, consumo_giornaliero, nome_commerciale')
    .eq('org_id', orgId)
    .eq('categoria', categoria);
  if (sala) esistentiQuery.eq('sala', sala);
  if (uoAttivaId) esistentiQuery.eq('unita_operativa_id', uoAttivaId);
  const { data: esistenti } = await esistentiQuery;

  const normalizza = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const nuovi = [];
  let aggiornati = 0;

  for (const p of estratti) {
    // Cerca un prodotto esistente con stesso principio attivo + forma + dosaggio
    const match = (esistenti ?? []).find(
      (e) =>
        normalizza(e.principio_attivo) === normalizza(p.principio_attivo) &&
        e.forma_farmaceutica === p.forma_farmaceutica &&
        normalizza(e.dosaggio ?? '') === normalizza(p.dosaggio ?? ''),
    );

    if (match) {
      // Incrementa il consumo giornaliero
      await supabase
        .from('prodotti')
        .update({
          consumo_giornaliero: (match.consumo_giornaliero ?? 1) + p.consumo_giornaliero,
          ...(p.nome_commerciale && !match.nome_commerciale ? { nome_commerciale: p.nome_commerciale } : {}),
        })
        .eq('id', match.id);
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
        ...(uoAttivaId ? { unita_operativa_id: uoAttivaId } : {}),
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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Sei un assistente per una farmacia ospedaliera italiana. Analizza questa immagine (potrebbe essere una lista di terapie, un foglio di richiesta farmaci, una lista pazienti con terapie, ecc.) ed estrai tutti i farmaci/prodotti presenti.

Per ogni farmaco restituisci SOLO un oggetto JSON nell'array, con questi campi:
- principio_attivo: string (nome del principio attivo, in italiano, maiuscolo iniziale)
- nome_commerciale: string | null
- forma_farmaceutica: una di: "compressa","capsula","fiala","flacone","bustina","cerotto","supposte","sciroppo","crema","collirio","altro"
- dosaggio: string | null (es. "500 mg", "1 g/100 ml")
- consumo_giornaliero: number (unità al giorno per paziente, default 1 se non specificato)
- note: string | null

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo. Esempio:
[{"principio_attivo":"Amoxicillina","nome_commerciale":"Augmentin","forma_farmaceutica":"compressa","dosaggio":"875 mg","consumo_giornaliero":2,"note":null}]

Se non trovi farmaci rispondi con array vuoto: []`,
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

  if (!estratti.length) return { error: 'Nessun farmaco riconosciuto nell\'immagine.' };

  const esistentiQuery = supabase
    .from('prodotti')
    .select('id, principio_attivo, forma_farmaceutica, dosaggio, consumo_giornaliero, nome_commerciale')
    .eq('org_id', orgId)
    .eq('categoria', categoria);
  if (sala) esistentiQuery.eq('sala', sala);
  if (uoAttivaId) esistentiQuery.eq('unita_operativa_id', uoAttivaId);
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
      await supabase.from('prodotti').update({
        consumo_giornaliero: (match.consumo_giornaliero ?? 1) + p.consumo_giornaliero,
        ...(p.nome_commerciale && !match.nome_commerciale ? { nome_commerciale: p.nome_commerciale } : {}),
      }).eq('id', match.id);
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
        ...(uoAttivaId ? { unita_operativa_id: uoAttivaId } : {}),
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
