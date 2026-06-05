'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';
import { inflateSync } from 'zlib';

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

  const estratti = parseTerapiaText(testo);
  if (!estratti.length) {
    const anteprima = testo.slice(0, 300).replace(/\n+/g, ' ↵ ');
    return { error: `Testo estratto ma nessun farmaco riconosciuto.\n\nAnteprima: "${anteprima}"` };
  }

  const insertions = estratti.map((p) => ({
    org_id: orgId,
    categoria,
    principio_attivo: p.principio_attivo,
    forma_farmaceutica: p.forma_farmaceutica,
    dosaggio: p.dosaggio || null,
    quantita: 0,
    consumo_giornaliero: p.consumo_giornaliero,
    note: p.note || null,
  }));

  const { error: dbError } = await supabase.from('prodotti').insert(insertions);
  if (dbError) return { error: dbError.message };

  revalidatePath(`/${categoria}`);
  return { ok: true, count: estratti.length };
}
