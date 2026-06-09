'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface GaraFormData {
  numero_gara: string;
  descrizione: string;
  categoria: 'farmaci' | 'sanitario' | 'entrambi';
  ditta_aggiudicataria: string;
  prezzo_unitario: string;
  unita_misura: string;
  data_inizio: string;
  data_scadenza: string;
  lotto: string;
  aic: string;
  note: string;
}

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
  return data?.organization_id ?? null;
}

export async function aggiungiGaraAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return { error: 'Organizzazione non trovata.' };

  const prezzoRaw = String(formData.get('prezzo_unitario') ?? '').replace(',', '.');
  const prezzo = prezzoRaw ? parseFloat(prezzoRaw) : null;

  const { error } = await supabase.from('gare_appalto').insert({
    org_id: orgId,
    numero_gara: String(formData.get('numero_gara') ?? '').trim(),
    descrizione: String(formData.get('descrizione') ?? '').trim(),
    categoria: String(formData.get('categoria') ?? 'farmaci') as 'farmaci' | 'sanitario' | 'entrambi',
    ditta_aggiudicataria: String(formData.get('ditta_aggiudicataria') ?? '').trim(),
    prezzo_unitario: isNaN(prezzo as number) ? null : prezzo,
    unita_misura: String(formData.get('unita_misura') ?? '').trim() || null,
    data_inizio: String(formData.get('data_inizio') ?? '').trim() || null,
    data_scadenza: String(formData.get('data_scadenza') ?? '').trim() || null,
    lotto: String(formData.get('lotto') ?? '').trim() || null,
    aic: String(formData.get('aic') ?? '').trim() || null,
    note: String(formData.get('note') ?? '').trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/gare');
  return { ok: true };
}

export async function modificaGaraAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const prezzoRaw = String(formData.get('prezzo_unitario') ?? '').replace(',', '.');
  const prezzo = prezzoRaw ? parseFloat(prezzoRaw) : null;

  const { error } = await supabase.from('gare_appalto').update({
    numero_gara: String(formData.get('numero_gara') ?? '').trim(),
    descrizione: String(formData.get('descrizione') ?? '').trim(),
    categoria: String(formData.get('categoria') ?? 'farmaci') as 'farmaci' | 'sanitario' | 'entrambi',
    ditta_aggiudicataria: String(formData.get('ditta_aggiudicataria') ?? '').trim(),
    prezzo_unitario: isNaN(prezzo as number) ? null : prezzo,
    unita_misura: String(formData.get('unita_misura') ?? '').trim() || null,
    data_inizio: String(formData.get('data_inizio') ?? '').trim() || null,
    data_scadenza: String(formData.get('data_scadenza') ?? '').trim() || null,
    lotto: String(formData.get('lotto') ?? '').trim() || null,
    aic: String(formData.get('aic') ?? '').trim() || null,
    note: String(formData.get('note') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/gare');
  return { ok: true };
}

export async function eliminaGaraAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('gare_appalto').delete().eq('id', id);
  revalidatePath('/gare');
  return { ok: true };
}
