'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function getOrgId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();
  if (!data) redirect('/app');
  return data.organization_id;
}

export async function assegnaTerapiaAction(
  pazienteId: string,
  principioAttivo: string,
  dosaggio: string,
  posologia: string,
  prodottoId?: string,
) {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { error } = await supabase.from('terapie_pazienti').insert({
    org_id: orgId,
    paziente_id: pazienteId,
    principio_attivo: principioAttivo,
    dosaggio: dosaggio || null,
    posologia: posologia || null,
    prodotto_id: prodottoId ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/pazienti');
}

export async function rimuoviTerapiaAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('terapie_pazienti').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/pazienti');
}
