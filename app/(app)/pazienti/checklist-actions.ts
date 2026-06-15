'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const VOCI_STANDARD = [
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

export interface VoceChecklist {
  id: string;
  voce: string;
  completata: boolean;
  completata_da: string | null;
  completata_at: string | null;
  ordine: number;
}

export async function getChecklistAction(pazienteId: string): Promise<VoceChecklist[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('checklist_dimissione')
    .select('*')
    .eq('paziente_id', pazienteId)
    .order('ordine');

  return (data ?? []) as VoceChecklist[];
}

export async function inizializzaChecklistAction(pazienteId: string, orgId: string, codiceSdo?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  // Controlla se esiste già
  const { count } = await supabase
    .from('checklist_dimissione')
    .select('id', { count: 'exact', head: true })
    .eq('paziente_id', pazienteId);

  if ((count ?? 0) > 0) return { ok: true, existing: true };

  const voci = VOCI_STANDARD.map((voce, i) => ({
    org_id: orgId,
    paziente_id: pazienteId,
    codice_sdo: codiceSdo ?? null,
    voce,
    ordine: i,
    completata: false,
  }));

  const { error } = await supabase.from('checklist_dimissione').insert(voci);
  if (error) return { error: error.message };

  revalidatePath('/pazienti');
  return { ok: true };
}

export async function toggleVoceAction(voceId: string, completata: boolean, completataDa: string) {
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

  revalidatePath('/pazienti');
  return { ok: true };
}

export async function aggiornaSdoPazienteAction(
  pazienteId: string,
  codiceSdo: string,
  dataRicovero?: string,
  dataDimissione?: string,
  diagnosiPrincipale?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase
    .from('pazienti')
    .update({
      codice_sdo: codiceSdo || null,
      data_ricovero: dataRicovero || null,
      data_dimissione: dataDimissione || null,
      diagnosi_principale: diagnosiPrincipale || null,
    })
    .eq('id', pazienteId);

  // Aggiorna anche il codice SDO nelle voci checklist esistenti
  if (codiceSdo) {
    await supabase
      .from('checklist_dimissione')
      .update({ codice_sdo: codiceSdo })
      .eq('paziente_id', pazienteId);
  }

  revalidatePath('/pazienti');
  return { ok: true };
}
