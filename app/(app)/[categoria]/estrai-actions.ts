'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';

async function estraiTestoDaPdf(buffer: Buffer): Promise<string> {
  // unpdf: progettato per serverless/edge, nessun problema di worker
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    if (text && text.trim().length > 10) return text;
  } catch {
    // fallback
  }

  // Fallback: estrazione grezza dai blocchi BT/ET del PDF
  const str = buffer.toString('latin1');
  const lines: string[] = [];
  const btBlocks = str.match(/BT\s*([\s\S]*?)\s*ET/g) ?? [];
  for (const block of btBlocks) {
    const txts = block.match(/\(([^)]{1,200})\)\s*(?:Tj|TJ)/g) ?? [];
    for (const t of txts) {
      const m = t.match(/\(([^)]+)\)/);
      if (m) lines.push(m[1]);
    }
  }
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
    return { error: 'Nessun testo leggibile nel PDF. Il file potrebbe essere una scansione immagine.' };
  }

  const estratti = parseTerapiaText(testo);
  if (!estratti.length) {
    const anteprima = testo.slice(0, 400).replace(/\n+/g, ' ↵ ');
    return {
      error: `Testo estratto (${testo.length} caratteri) ma nessun farmaco riconosciuto automaticamente.\n\nAnteprima: "${anteprima}"\n\nMandami questa anteprima così miglioro il riconoscimento per i tuoi PDF.`,
    };
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
