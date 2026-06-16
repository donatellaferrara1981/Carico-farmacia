'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function aggiungiEsameIcaAction(
  orgId: string,
  paziente: string,
  tipologiaEsame: string,
  dataInvio: string | null,
  dataReferto: string | null,
  risultato: string | null,
  note: string | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase.from('ica_esami').insert({
    org_id: orgId,
    paziente: paziente.trim().toUpperCase(),
    tipologia_esame: tipologiaEsame.trim(),
    data_invio: dataInvio || null,
    data_referto: dataReferto || null,
    risultato: risultato?.trim() || null,
    note: note?.trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/report-ica');
  return { ok: true };
}

export async function aggiornaEsameIcaAction(
  id: string,
  risultato: string | null,
  dataReferto: string | null,
  note: string | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase.from('ica_esami').update({
    risultato: risultato?.trim() || null,
    data_referto: dataReferto || null,
    note: note?.trim() || null,
  }).eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/report-ica');
  return { ok: true };
}

export async function eliminaEsameIcaAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('ica_esami').delete().eq('id', id);
  revalidatePath('/report-ica');
  return { ok: true };
}
