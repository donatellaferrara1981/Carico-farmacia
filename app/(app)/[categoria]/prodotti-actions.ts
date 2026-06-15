'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { FormaFarmaceutica } from '@/lib/prodotti';
import { getUoAttivaId } from '@/lib/uo-cookie';

export interface ProdottoFormData {
  principio_attivo: string;
  nome_commerciale: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  quantita: number;
  consumo_giornaliero: number;
  soglia_minima: number | null;
  data_scadenza: string;
  note: string;
  ciclo_totale?: number | null;
  data_inizio_ciclo?: string | null;
  quantita_consegnata?: number | null;
  data_consegna?: string | null;
  alert_esaurimento?: boolean;
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

  const uoAttivaId = await getUoAttivaId();

  const payload: Record<string, unknown> = {
    org_id: orgId,
    categoria,
    principio_attivo: data.principio_attivo.trim(),
    nome_commerciale: data.nome_commerciale?.trim() || null,
    forma_farmaceutica: data.forma_farmaceutica,
    dosaggio: data.dosaggio.trim() || null,
    quantita: data.quantita,
    consumo_giornaliero: data.consumo_giornaliero,
    soglia_minima: data.soglia_minima ?? null,
    data_scadenza: data.data_scadenza || null,
    note: data.note.trim() || null,
    ciclo_totale: data.ciclo_totale ?? null,
    data_inizio_ciclo: data.data_inizio_ciclo || null,
    quantita_consegnata: data.quantita_consegnata ?? null,
    data_consegna: data.data_consegna || null,
    alert_esaurimento: data.alert_esaurimento !== false,
  };

  if (!id && uoAttivaId) {
    payload.unita_operativa_id = uoAttivaId;
  }

  const { error } = id
    ? await supabase.from('prodotti').update(payload).eq('id', id)
    : await supabase.from('prodotti').insert(payload);

  if (error) return { error: error.message };
  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function svuotaProdottiAction(orgId: string, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.from('prodotti').delete().eq('org_id', orgId).eq('categoria', categoria);
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

  // nominativa_manuale=true blocca la sovrascrittura automatica da sincronizzaNominativeAction
  await supabase.from('prodotti').update({ nominativa, nominativa_manuale: true }).eq('id', id);
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

export async function aggiornaOrdineSanitarioAction(prodottoId: string, quantitaSettimana: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();
  if (!uoAttivaId) return { error: 'Nessuna unità operativa attiva.' };

  // Leggi i dati correnti della UO attiva da sanitario_ordini
  const { data: ord } = await supabase
    .from('sanitario_ordini')
    .select('consumo_giornaliero, consumo_medio, org_id')
    .eq('prodotto_id', prodottoId)
    .eq('unita_operativa_id', uoAttivaId)
    .maybeSingle();

  // Se non esiste ancora un record, recupera org_id dal prodotto
  let orgId = ord?.org_id;
  if (!orgId) {
    const { data: p } = await supabase.from('prodotti').select('org_id').eq('id', prodottoId).single();
    orgId = p?.org_id;
  }
  if (!orgId) return { error: 'Prodotto non trovato.' };

  const vecchio = Number(ord?.consumo_giornaliero ?? 0);
  const mediaVecchia = Number(ord?.consumo_medio ?? vecchio);
  const nuovaMedia = vecchio > 0
    ? Math.round(((mediaVecchia * 3 + vecchio) / 4) * 10) / 10
    : quantitaSettimana;

  await supabase.from('sanitario_ordini').upsert({
    org_id: orgId,
    prodotto_id: prodottoId,
    unita_operativa_id: uoAttivaId,
    consumo_giornaliero: quantitaSettimana,
    quantita_consegnata: vecchio > 0 ? vecchio : null,
    consumo_medio: nuovaMedia,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'prodotto_id,unita_operativa_id' });

  revalidatePath('/sanitario');
  revalidatePath('/economale');
  return { ok: true };
}

export async function spostaCategoriaAction(prodottoId: string, daCategoria: string, aCategoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase
    .from('prodotti')
    .update({ categoria: aCategoria })
    .eq('id', prodottoId);

  if (error) return { error: error.message };
  revalidatePath(`/${daCategoria}`);
  revalidatePath(`/${aCategoria}`);
  return { ok: true };
}

export async function aggiornaDataRichiestaAction(
  prodottoId: string,
  dataUltimaRichiesta: string,
  giorniValidita: number,
  categoria: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { data: prodotto } = await supabase
    .from('prodotti')
    .select('principio_attivo, org_id')
    .eq('id', prodottoId)
    .single();
  if (!prodotto) return { error: 'Prodotto non trovato.' };

  await supabase
    .from('prodotti')
    .update({ data_ultima_richiesta: dataUltimaRichiesta, giorni_validita_richiesta: giorniValidita })
    .eq('id', prodottoId);

  // Calcola scadenza rinnovo
  const scadenza = new Date(dataUltimaRichiesta);
  scadenza.setDate(scadenza.getDate() + giorniValidita);

  // Upsert promemoria di rinnovo (elimina vecchi per questo prodotto, crea nuovo)
  await supabase
    .from('promemoria')
    .delete()
    .eq('prodotto_id', prodottoId)
    .eq('tipo', 'sistema');

  await supabase.from('promemoria').insert({
    organization_id: prodotto.org_id,
    prodotto_id: prodottoId,
    tipo: 'sistema',
    stato: 'pendente',
    testo: `Rinnovo prescrizione nominativa: ${prodotto.principio_attivo}`,
    scadenza: scadenza.toISOString(),
    created_by: user.id,
  });

  revalidatePath(`/${categoria}`);
  return { ok: true };
}
