'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const VOCI_STANDARD = [
  'Documento Tribunale per Amministratore di Sostegno',
  'Foglio di ricovero stampato da ADT e firma del consenso al trattamento dei dati personali in calce al foglio',
  'Accettazione condizioni di ricovero firmato dal paziente o dal suo rappresentante legale e dal medico che accetta il paziente',
  'Elenco documentazione consegnata e firmata dal paziente/familiare controfirmata anche dal medico',
  'Consenso informato al trattamento neuroriabilitativo controfirmato dal paziente/familiare e medico',
  'Documento di riconoscimento e tessera sanitaria',
  'Algoritmo per la definizione del rischio datato e firmato dal medico che accetta il paziente',
  'Scala di valutazione del rischio caduta compilata e firmata dal medico',
  'Visual Analogue Scale (VAS) per il dolore compilata al ricovero e ogni 3 giorni per tutta la durata del ricovero',
  'Scheda di valutazione delle ulcere da decubito',
  'Scheda alta criticità',
  'Check list ICF da compilare, datare e firmare; inserire il caregiver nell\'ultimo foglio',
  'Proposta di ricovero',
  'Scheda di valutazione al ricovero firmata',
  'Impegnativa (se proveniente dal domicilio)',
  'Scheda di accesso ospedaliero del medico curante ALLEGATO E/D (se proveniente dal domicilio)',
  'Diaria giornaliera su Tabula',
  'Relazione di dimissione datata e firmata dal medico, dal medico in doppia copia',
  'SDO stampata e firmata',
  'Frontespizio cartella elettronica + diagnosi di ingresso e dimissione stampato e firmato',
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

export async function reinizializzaChecklistAction(pazienteId: string, orgId: string, codiceSdo?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('checklist_dimissione').delete().eq('paziente_id', pazienteId);

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

export async function aggiornaVoceTestoAction(voceId: string, nuovoTesto: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase
    .from('checklist_dimissione')
    .update({ voce: nuovoTesto.trim() })
    .eq('id', voceId);

  if (error) return { error: error.message };
  revalidatePath('/pazienti');
  return { ok: true };
}

export async function getArchivioChecklistAction(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('checklist_dimissione')
    .select('paziente_id, codice_sdo, voce, completata, completata_da, completata_at, ordine')
    .eq('org_id', orgId)
    .order('paziente_id')
    .order('ordine');

  return data ?? [];
}
