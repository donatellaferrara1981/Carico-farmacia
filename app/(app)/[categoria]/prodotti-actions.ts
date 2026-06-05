'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { FormaFarmaceutica } from '@/lib/prodotti';

export interface ProdottoFormData {
  principio_attivo: string;
  nome_commerciale: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  quantita: number;
  consumo_giornaliero: number;
  note: string;
}

export async function upsertProdottoAction(
  orgId: string,
  categoria: string,
  data: ProdottoFormData,
  id?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const payload = {
    org_id: orgId,
    categoria,
    principio_attivo: data.principio_attivo.trim(),
    nome_commerciale: data.nome_commerciale?.trim() || null,
    forma_farmaceutica: data.forma_farmaceutica,
    dosaggio: data.dosaggio.trim() || null,
    quantita: data.quantita,
    consumo_giornaliero: data.consumo_giornaliero,
    note: data.note.trim() || null,
  };

  const { error } = id
    ? await supabase.from('prodotti').update(payload).eq('id', id)
    : await supabase.from('prodotti').insert(payload);

  if (error) return { error: error.message };
  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function deleteProdottoAction(id: string, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('prodotti').delete().eq('id', id);
  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function toggleNominativaAction(id: string, nominativa: boolean, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('prodotti').update({ nominativa }).eq('id', id);
  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function aggiornaQuantitaAction(id: string, delta: number, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { data: p } = await supabase.from('prodotti').select('quantita').eq('id', id).single();
  if (!p) return { error: 'Prodotto non trovato.' };

  const nuova = Math.max(0, p.quantita + delta);
  await supabase.from('prodotti').update({ quantita: nuova }).eq('id', id);
  revalidatePath(`/${categoria}`);
  return { ok: true };
}
