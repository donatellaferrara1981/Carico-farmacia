'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { FormaFarmaceutica } from '@/lib/prodotti';

interface ProdottoEstratto {
  principio_attivo: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  quantita: number;
  consumo_giornaliero: number;
  note: string;
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

  // Scarica il file dallo storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from('documenti')
    .download(storagePath);
  if (dlError || !fileData) return { error: 'Impossibile scaricare il file.' };

  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mediaType = fileData.type === 'application/pdf' ? 'application/pdf' : fileData.type;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let extracted: ProdottoEstratto[] = [];
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mediaType as 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Sei un assistente farmaceutico. Analizza questo documento di terapia e estrai TUTTI i farmaci/prodotti presenti.

Per ogni prodotto restituisci un JSON array con questi campi:
- principio_attivo: nome generico del farmaco (stringa)
- forma_farmaceutica: uno ESATTO tra: "compressa", "capsula", "fiala", "crema", "flacone_infusione", "sciroppo", "supposta", "cerotto", "collirio", "altro"
- dosaggio: es. "500 mg", "1 g/100 ml", "0.9%" (stringa, vuota se non indicato)
- quantita: numero di pezzi/confezioni attualmente disponibili, metti 0 se non indicato
- consumo_giornaliero: quante unità al giorno in totale sommando tutti i turni (numero decimale, es. 2 o 0.5)
- note: informazioni aggiuntive come via di somministrazione, diluizione, orari (stringa, vuota se nessuna)

Rispondi SOLO con il JSON array, senza testo aggiuntivo. Esempio:
[{"principio_attivo":"Paracetamolo","forma_farmaceutica":"compressa","dosaggio":"500 mg","quantita":0,"consumo_giornaliero":3,"note":""},{"principio_attivo":"Fisiologica","forma_farmaceutica":"flacone_infusione","dosaggio":"0.9% 500 ml","quantita":0,"consumo_giornaliero":2,"note":"EV lenta"}]`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { error: 'Nessun prodotto riconosciuto nel documento.' };
    extracted = JSON.parse(jsonMatch[0]) as ProdottoEstratto[];
  } catch (e) {
    return { error: `Errore AI: ${e instanceof Error ? e.message : 'sconosciuto'}` };
  }

  if (!extracted.length) return { error: 'Nessun prodotto trovato nel documento.' };

  // Inserisce i prodotti estratti nel database
  const insertions = extracted.map((p) => ({
    org_id: orgId,
    categoria,
    principio_attivo: p.principio_attivo.trim(),
    forma_farmaceutica: p.forma_farmaceutica,
    dosaggio: p.dosaggio?.trim() || null,
    quantita: p.quantita ?? 0,
    consumo_giornaliero: p.consumo_giornaliero ?? 0,
    note: p.note?.trim() || null,
  }));

  const { error: dbError } = await supabase.from('prodotti').insert(insertions);
  if (dbError) return { error: dbError.message };

  revalidatePath(`/${categoria}`);
  return { ok: true, count: extracted.length, prodotti: extracted };
}
