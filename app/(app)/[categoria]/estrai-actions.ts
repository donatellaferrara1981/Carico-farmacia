'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';

// Pulizia escape sequences problematici nei PDF PHP/FPDF
function sanitizzaPdf(buffer: Buffer): Buffer {
  // Alcuni PDF generati da PHP usano escape sequences non standard (\u, \x non validi)
  // Li normalizziamo nel raw binario prima di passarlo al parser
  const str = buffer.toString('binary');
  const pulito = str
    .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '') // \uXXX incompleti
    .replace(/\\x[0-9a-fA-F]{0,1}(?![0-9a-fA-F])/g, ''); // \xX incompleti
  return Buffer.from(pulito, 'binary');
}

// Estrazione grezza dal binario PDF (BT/ET blocks)
function estrazioneGrezzaFallback(buffer: Buffer): string {
  const str = buffer.toString('latin1');
  const lines: string[] = [];

  // Cerca blocchi testo BT...ET (struttura standard PDF)
  const btBlocks = str.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of btBlocks) {
    // Stringhe tra parentesi seguite da Tj/TJ
    const txts = block.match(/\(([^)]{1,300})\)\s*(?:Tj|TJ)/g) ?? [];
    for (const t of txts) {
      const m = t.match(/\(([^)]+)\)/);
      if (m) {
        const testo = m[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\t/g, ' ')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{2,}/.test(testo)) lines.push(testo);
      }
    }
  }

  // Fallback: tutte le stringhe tra parentesi con almeno 2 lettere
  if (lines.length === 0) {
    const matches = str.match(/\(([^\)]{2,100})\)/g) ?? [];
    for (const m of matches) {
      const txt = m.slice(1, -1).replace(/\\[nrt]/g, ' ');
      if (/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{2,}/.test(txt)) lines.push(txt);
    }
  }

  return lines.join('\n');
}

async function estraiTestoDaPdf(buffer: Buffer): Promise<string> {
  // Tentativo 1: unpdf con buffer sanitizzato
  const bufferPulito = sanitizzaPdf(buffer);
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(bufferPulito), { mergePages: true });
    if (text && text.trim().length > 10) return text;
  } catch {
    // unpdf fallito, prova con buffer originale
  }

  // Tentativo 2: unpdf con buffer originale (nel caso la sanitizzazione abbia rotto qualcosa)
  if (bufferPulito !== buffer) {
    try {
      const { extractText } = await import('unpdf');
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
      if (text && text.trim().length > 10) return text;
    } catch {
      // anche questo fallito
    }
  }

  // Tentativo 3: estrazione grezza dal binario
  return estrazioneGrezzaFallback(buffer);
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
    const anteprima = testo.slice(0, 500).replace(/\n+/g, ' ↵ ');
    return {
      error: `Testo estratto (${testo.length} car.) ma nessun farmaco riconosciuto.\n\nAnteprima: "${anteprima}"`,
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
