'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';

async function estraiTestoDaPdf(buffer: Buffer): Promise<string> {
  // Tentativo 1: pdfjs-dist legacy (robusto con PDF ospedalieri)
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Disabilita worker per esecuzione in Node.js (stringa vuota = main thread)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const testi: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Ricostruisce le righe preservando la struttura
      let rigaCorrente = '';
      const righe: string[] = [];
      for (const item of content.items) {
        const it = item as { str?: string; hasEOL?: boolean; transform?: number[] };
        const testo = it.str ?? '';
        rigaCorrente += testo;
        if (it.hasEOL || testo.endsWith('\n')) {
          righe.push(rigaCorrente.trim());
          rigaCorrente = '';
        } else if (testo.endsWith(' ') || testo === '') {
          rigaCorrente += ' ';
        }
      }
      if (rigaCorrente.trim()) righe.push(rigaCorrente.trim());
      testi.push(righe.join('\n'));
    }
    const testo = testi.join('\n');
    if (testo.trim().length > 20) return testo;
  } catch {
    // passa al metodo 2
  }

  // Tentativo 2: pdf-parse standard
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer, { max: 0 });
    if (data.text?.trim().length > 20) return data.text;
  } catch {
    // passa al metodo 3
  }

  // Tentativo 3: estrazione grezzo dal binario
  const str = buffer.toString('latin1');
  const lines: string[] = [];
  // Cerca testo in BT...ET blocks
  const btBlocks = str.match(/BT\s*([\s\S]*?)\s*ET/g) ?? [];
  for (const block of btBlocks) {
    const txts = block.match(/\(([^)]{1,200})\)\s*(?:Tj|TJ)/g) ?? [];
    for (const t of txts) {
      const m = t.match(/\(([^)]+)\)/);
      if (m) lines.push(m[1]);
    }
  }
  // Fallback: cerca tutte le sequenze tra parentesi
  if (lines.length === 0) {
    const matches = str.match(/\(([^\)]{2,80})\)/g) ?? [];
    for (const m of matches) {
      const txt = m.slice(1, -1);
      if (/[a-zA-ZàèìòùÀÈÌÒÙ]{2,}/.test(txt)) lines.push(txt);
    }
  }
  return lines.join('\n');
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
    return { error: 'Nessun testo trovato nel PDF. Il file è probabilmente una scansione immagine — carica i prodotti manualmente.' };
  }

  const estratti = parseTerapiaText(testo);
  if (!estratti.length) {
    // Restituisce anche un anteprima del testo estratto per debug
    const anteprima = testo.slice(0, 300).replace(/\n+/g, ' ↵ ');
    return { error: `Testo estratto (${testo.length} car.) ma nessun farmaco riconosciuto. Anteprima: "${anteprima}"` };
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
