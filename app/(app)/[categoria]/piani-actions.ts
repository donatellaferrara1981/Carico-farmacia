'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface RigaPiano {
  principio_attivo: string;
  nome_commerciale: string | null;
  forma_farmaceutica: string;
  dosaggio: string | null;
  consumo_giornaliero: number;
  fabbisogno: number;
  quantita_disponibile: number;
  da_ordinare: number;
}

export async function salvaPianoAction(
  orgId: string,
  categoria: string,
  data: {
    titolo: string;
    data_inizio: string;
    data_fine: string;
    giorni: number;
    note: string;
    righe: RigaPiano[];
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase.from('piani_fabbisogno').insert({
    org_id: orgId,
    categoria,
    ...data,
  });

  if (error) return { error: error.message };
  revalidatePath('/calendario');
  return { ok: true };
}

export async function eliminaPianoAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('piani_fabbisogno').delete().eq('id', id);
  revalidatePath('/calendario');
  return { ok: true };
}
