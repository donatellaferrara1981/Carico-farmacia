'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';

async function estraiTestoDaPdf(buffer: Buffer): Promise<string> {
  // Tentativo 1: pdfjs-dist (più robusto con PDF clinici)
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const testi: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: unknown) => (item as { str?: string }).str ?? '')
        .join(' ');
      testi.push(pageText);
    }
    const testo = testi.join('\n');
    if (testo.trim()) return testo;
  } catch {
    // fallback al secondo metodo
  }

  // Tentativo 2: pdf-parse come fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(buffer);
    if (data.text?.trim()) return data.text;
  } catch {
    // fallback al parsing manuale
  }

  // Tentativo 3: estrazione testo grezzo dal binario PDF
  const str = buffer.toString('latin1');
  const matches = str.match(/\(([^\)]{2,})\)/g) ?? [];
  const grezzo = matches
    .map((m) => m.slice(1, -1))
    .filter((s) => /[a-zA-ZàèìòùÀÈÌÒÙ]{2,}/.test(s))
    .join(' ');
  return grezzo;
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
    return { error: 'Nessun testo trovato nel PDF. Il file potrebbe essere una scansione immagine — carica i prodotti manualmente.' };
  }

  const estratti = parseTerapiaText(testo);
  if (!estratti.length) {
    return { error: 'Testo estratto ma nessun farmaco riconosciuto. Mandami un esempio del PDF per migliorare il riconoscimento.' };
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
