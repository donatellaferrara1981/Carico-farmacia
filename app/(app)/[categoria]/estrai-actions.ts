'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseTerapiaText } from '@/lib/parse-terapia';

// Estrazione diretta dai stream di testo PDF (BT/ET blocks)
// Funziona con qualsiasi PDF inclusi quelli generati da PHP/FPDF
function estrazioneDirecta(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const lines: string[] = [];

  // Strategia 1: blocchi BT ... ET con operatori Tj / TJ / '
  const btBlocks = raw.match(/BT[\s\S]*?ET/g) ?? [];
  for (const block of btBlocks) {
    // Raccoglie tutte le stringhe PDF nel blocco
    // Formato: (testo)Tj  oppure [(testo)]TJ  oppure (testo)'
    const re = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      const decoded = decodePdfString(m[1]);
      if (decoded.trim().length > 0) lines.push(decoded);
    }
  }

  // Strategia 2: se BT/ET non trovati, cerca tutte le (stringa)Tj nel file
  if (lines.length === 0) {
    const re2 = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    let m;
    while ((m = re2.exec(raw)) !== null) {
      const decoded = decodePdfString(m[1]);
      if (decoded.trim().length > 0) lines.push(decoded);
    }
  }

  // Strategia 3: tutte le stringhe tra parentesi con almeno 3 lettere
  if (lines.length === 0) {
    const re3 = /\(([^)]{2,120})\)/g;
    let m;
    while ((m = re3.exec(raw)) !== null) {
      const txt = m[1].replace(/\\[nrt\\()]/g, ' ');
      if (/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(txt)) lines.push(txt);
    }
  }

  return lines.join('\n');
}

// Decodifica le escape sequences delle stringhe PDF (non JavaScript)
function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\./g, ''); // rimuovi escape sequences sconosciute
}

async function estraiTestoDaPdf(buffer: Buffer): Promise<string> {
  // Prima prova: estrazione diretta (non dipende da librerie esterne, non può crashare)
  const testoGrezzo = estrazioneDirecta(buffer);
  if (testoGrezzo.trim().length > 20) return testoGrezzo;

  // Seconda prova: unpdf (gestisce PDF con encoding complesso)
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    if (text && text.trim().length > 10) return text;
  } catch {
    // unpdf non riesce, usa quello che abbiamo già
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
