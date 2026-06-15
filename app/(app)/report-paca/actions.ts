'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type EsitoPaca = 'in_corso' | 'approvata' | 'rifiutata' | 'in_revisione';

export async function aggiornaEsitoPacaAction(
  pazienteId: string,
  esito: EsitoPaca,
  importoDrg: number | null,
  dataChiusura: string | null,
  notePaca: string | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase
    .from('pazienti')
    .update({
      esito_paca: esito,
      importo_drg: importoDrg,
      data_chiusura_cartella: dataChiusura || null,
      note_paca: notePaca || null,
    })
    .eq('id', pazienteId);

  if (error) return { error: error.message };
  revalidatePath('/report-paca');
  revalidatePath('/pazienti');
  return { ok: true };
}

export async function aggiungiVoceChecklistAction(
  pazienteId: string,
  orgId: string,
  nuovaVoce: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  // Calcola ordine massimo esistente
  const { data: esistenti } = await supabase
    .from('checklist_dimissione')
    .select('ordine')
    .eq('paziente_id', pazienteId)
    .order('ordine', { ascending: false })
    .limit(1);

  const ordine = ((esistenti?.[0]?.ordine ?? -1) as number) + 1;

  const { error } = await supabase.from('checklist_dimissione').insert({
    org_id: orgId,
    paziente_id: pazienteId,
    voce: nuovaVoce.trim(),
    ordine,
    completata: false,
  });

  if (error) return { error: error.message };
  revalidatePath('/pazienti');
  return { ok: true };
}

export async function eliminaVoceChecklistAction(voceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('checklist_dimissione').delete().eq('id', voceId);
  revalidatePath('/pazienti');
  return { ok: true };
}

export async function modificaVoceChecklistAction(voceId: string, nuovoTesto: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('checklist_dimissione').update({ voce: nuovoTesto.trim() }).eq('id', voceId);
  revalidatePath('/pazienti');
  return { ok: true };
}

export async function toggleVoceChecklistPacaAction(voceId: string, completata: boolean, completataDa: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase
    .from('checklist_dimissione')
    .update({
      completata,
      completata_da: completata ? completataDa : null,
      completata_at: completata ? new Date().toISOString() : null,
    })
    .eq('id', voceId);

  revalidatePath('/report-paca');
  revalidatePath('/pazienti');
  return { ok: true };
}

const VOCI_STANDARD_CHECKLIST = [
  'Cartella clinica compilata e firmata',
  'SDO compilata e validata',
  'Epicrisi firmata dal medico responsabile',
  'Lettera di dimissione redatta e firmata',
  'Piano terapeutico alla dimissione allegato',
  'Referti esami allegati',
  'Immagini diagnostiche archiviate',
  'Consensi informati archiviati',
  'Ricette SSN emesse',
  'Farmaci alla dimissione consegnati',
  'Istruzioni scritte al paziente/familiari',
  'Appuntamento follow-up programmato',
];

export async function inizializzaChecklistPacaAction(pazienteId: string, orgId: string, codiceSdo?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { count } = await supabase
    .from('checklist_dimissione')
    .select('id', { count: 'exact', head: true })
    .eq('paziente_id', pazienteId);

  if ((count ?? 0) > 0) return { ok: true, existing: true };

  const voci = VOCI_STANDARD_CHECKLIST.map((voce, i) => ({
    org_id: orgId,
    paziente_id: pazienteId,
    codice_sdo: codiceSdo ?? null,
    voce,
    ordine: i,
    completata: false,
  }));

  const { error } = await supabase.from('checklist_dimissione').insert(voci);
  if (error) return { error: error.message };

  revalidatePath('/report-paca');
  revalidatePath('/pazienti');
  return { ok: true };
}
