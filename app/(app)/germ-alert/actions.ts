'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';

interface GermEstratto {
  germe: string;
  fonte_campione: string | null;
  data_rilevamento: string | null;
  sala: string | null;
  nominativo: string | null;
  numero_letto: number | null;
  sensibile: string[];
  resistente: string[];
  intermedio: string[];
  note: string | null;
}

export async function estraiGermAlertAction(
  fileBase64: string,
  mediaType: string,
  orgId: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const anthropic = new Anthropic();

  const isPdf = mediaType === 'application/pdf';
  const isImage = mediaType.startsWith('image/');

  let rawText = '';
  let germData: GermEstratto | null = null;

  const prompt = `Sei un assistente di microbiologia clinica. Analizza questo referto microbiologico e estrai i dati strutturati.

Estrai:
- germe: nome del microrganismo isolato (es. "Klebsiella pneumoniae", "Staphylococcus aureus")
- fonte_campione: tipo di campione (es. "urine", "sangue", "espettorato", "broncoaspirato")
- data_rilevamento: data del referto in formato YYYY-MM-DD (null se non presente)
- sala: nome della stanza/sala del paziente (null se non presente)
- nominativo: nome del paziente (null se non presente)
- numero_letto: numero del letto (null se non presente)
- sensibile: array di antibiotici a cui il germe è SENSIBILE (S)
- resistente: array di antibiotici a cui il germe è RESISTENTE (R)
- intermedio: array di antibiotici con sensibilità INTERMEDIA (I)
- note: eventuali note cliniche importanti (ESBL, KPC, MRSA, VRE, ecc.) — null se nessuna

Rispondi SOLO con JSON, nessun testo aggiuntivo:
{"germe":"...","fonte_campione":"...","data_rilevamento":"YYYY-MM-DD","sala":null,"nominativo":null,"numero_letto":null,"sensibile":["..."],"resistente":["..."],"intermedio":["..."],"note":null}`;

  if (isImage) {
    const imgType = mediaType as 'image/jpeg' | 'image/png' | 'image/webp';
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imgType, data: fileBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });
    rawText = msg.content[0].type === 'text' ? msg.content[0].text : '';
  } else if (isPdf) {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });
    rawText = msg.content[0].type === 'text' ? msg.content[0].text : '';
  } else {
    return { error: 'Formato file non supportato. Usa PDF o JPEG/PNG.' };
  }

  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) germData = JSON.parse(match[0]);
  } catch {
    return { error: `Risposta non interpretabile: ${rawText.slice(0, 300)}` };
  }

  if (!germData?.germe) return { error: 'Germe non riconosciuto nel documento.' };

  // Cerca paziente in DB per abbinarlo
  let pazienteId: string | null = null;
  if (germData.nominativo || (germData.sala && germData.numero_letto)) {
    const q = supabase.from('pazienti').select('id').eq('org_id', orgId);
    if (germData.nominativo) q.ilike('nominativo', `%${germData.nominativo.split(' ')[0]}%`);
    if (germData.sala) q.ilike('sala', `%${germData.sala}%`);
    if (germData.numero_letto) q.eq('numero_letto', germData.numero_letto);
    const { data } = await q.limit(1).single();
    pazienteId = data?.id ?? null;
  }

  const { error: dbError } = await supabase.from('germ_alert').insert({
    org_id: orgId,
    paziente_id: pazienteId,
    sala: germData.sala,
    numero_letto: germData.numero_letto,
    nominativo: germData.nominativo,
    germe: germData.germe,
    fonte_campione: germData.fonte_campione,
    data_rilevamento: germData.data_rilevamento,
    sensibile: germData.sensibile ?? [],
    resistente: germData.resistente ?? [],
    intermedio: germData.intermedio ?? [],
    note: germData.note,
    raw_text: rawText,
  });

  if (dbError) return { error: dbError.message };

  revalidatePath('/germ-alert');
  return { ok: true, germe: germData.germe };
}

export async function eliminaGermAlertAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('germ_alert').delete().eq('id', id);
  revalidatePath('/germ-alert');
  return { ok: true };
}
