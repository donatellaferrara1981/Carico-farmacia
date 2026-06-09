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

// ── Sincronizza flag nominativa in base alla copertura gare ──────────────────
function normMatch(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9àèìòù\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isCopertoServer(
  principioAttivo: string,
  gare: { descrizione: string; data_scadenza: string | null }[],
): boolean {
  const pa = normMatch(principioAttivo);
  const oggi = Date.now();
  return gare.some(g => {
    const nonScaduta = !g.data_scadenza || new Date(g.data_scadenza).getTime() > oggi;
    if (!nonScaduta) return false;
    const desc = normMatch(g.descrizione);
    return desc.includes(pa) || pa.split(' ').filter(w => w.length > 4).some(w => desc.includes(w));
  });
}

export async function sincronizzaNominativeAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return { error: 'Organizzazione non trovata.' };

  const [{ data: prodotti }, { data: gare }] = await Promise.all([
    supabase.from('prodotti').select('id, principio_attivo, nominativa, nominativa_manuale').eq('org_id', orgId),
    supabase.from('gare_appalto').select('descrizione, data_scadenza').eq('org_id', orgId),
  ]);

  if (!prodotti || !gare) return { error: 'Errore nel caricamento dati.' };

  // Aggiorna solo i prodotti che NON hanno il flag nominativa_manuale impostato
  const aggiornamenti: { id: string; nominativa: boolean }[] = [];
  for (const p of prodotti) {
    if (p.nominativa_manuale) continue; // skip override manuale
    const coperto = isCopertoServer(p.principio_attivo, gare);
    const nuovoValore = !coperto;
    if (p.nominativa !== nuovoValore) {
      aggiornamenti.push({ id: p.id, nominativa: nuovoValore });
    }
  }

  if (aggiornamenti.length > 0) {
    for (const a of aggiornamenti) {
      await supabase.from('prodotti').update({ nominativa: a.nominativa }).eq('id', a.id);
    }
  }

  const nonInGara = prodotti.filter(p => !isCopertoServer(p.principio_attivo, gare)).length;
  revalidatePath('/gare');
  revalidatePath('/app');
  return { ok: true, aggiornati: aggiornamenti.length, nonInGara, totale: prodotti.length };
}
