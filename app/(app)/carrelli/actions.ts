'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function penultimoMercolediDelMese(anno: number, mese: number): Date {
  const mercoledi: Date[] = [];
  const d = new Date(anno, mese, 1);
  while (d.getMonth() === mese) {
    if (d.getDay() === 3) mercoledi.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return mercoledi[mercoledi.length - 2];
}

export async function aggiungiArticoloAction(
  carelloId: string,
  orgId: string,
  data: {
    nome_articolo: string;
    forma_farmaceutica?: string;
    dosaggio?: string;
    lotto?: string;
    data_scadenza: string; // YYYY-MM-DD
    quantita?: number;
    note?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const scadenza = new Date(data.data_scadenza);
  const anno = scadenza.getFullYear();
  const mese = scadenza.getMonth();
  const dataAlert = penultimoMercolediDelMese(anno, mese);

  const { error } = await supabase.from('articoli_carrello').insert({
    carrello_id: carelloId,
    org_id: orgId,
    nome_articolo: data.nome_articolo,
    forma_farmaceutica: data.forma_farmaceutica ?? null,
    dosaggio: data.dosaggio ?? null,
    lotto: data.lotto ?? null,
    data_scadenza: data.data_scadenza,
    data_alert: dataAlert.toISOString().split('T')[0],
    quantita: data.quantita ?? 1,
    note: data.note ?? null,
    creato_da: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/carrelli');
}

export async function eliminaArticoloAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase.from('articoli_carrello').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/carrelli');
}

export async function aggiornaArticoloAction(
  id: string,
  data: {
    nome_articolo?: string;
    forma_farmaceutica?: string;
    dosaggio?: string;
    lotto?: string;
    data_scadenza?: string;
    quantita?: number;
    note?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const updateData: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };

  if (data.data_scadenza) {
    const scadenza = new Date(data.data_scadenza);
    const anno = scadenza.getFullYear();
    const mese = scadenza.getMonth();
    const dataAlert = penultimoMercolediDelMese(anno, mese);
    updateData.data_alert = dataAlert.toISOString().split('T')[0];
  }

  const { error } = await supabase.from('articoli_carrello').update(updateData).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/carrelli');
}

export async function rinominaCarrelloAction(id: string, nome: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase.from('carrelli_emergenza').update({ nome }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/carrelli');
}

export async function creaCarrelloAction(orgId: string, unitaOperativaId: string, nome: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase.from('carrelli_emergenza').insert({
    org_id: orgId,
    unita_operativa_id: unitaOperativaId,
    nome,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/carrelli');
}
