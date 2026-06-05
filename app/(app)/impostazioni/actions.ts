'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function aggiungiUnitaAction(orgId: string, nome: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  if (!nome.trim()) return { error: 'Inserisci il nome.' };

  const { error } = await supabase.from('unita_operative').insert({ org_id: orgId, nome: nome.trim() });
  if (error) {
    if (error.code === '23505') return { error: 'Unità già esistente.' };
    return { error: error.message };
  }
  revalidatePath('/impostazioni');
  return { ok: true };
}

export async function toggleUnitaAction(id: string, attiva: boolean) {
  const supabase = await createClient();
  await supabase.from('unita_operative').update({ attiva }).eq('id', id);
  revalidatePath('/impostazioni');
  return { ok: true };
}

export async function eliminaUnitaAction(id: string) {
  const supabase = await createClient();
  await supabase.from('unita_operative').delete().eq('id', id);
  revalidatePath('/impostazioni');
  return { ok: true };
}
