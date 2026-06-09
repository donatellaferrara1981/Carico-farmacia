'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('organization_members').select('organization_id').eq('user_id', userId).single();
  return data?.organization_id ?? null;
}

export async function archiaviaAvvisoAction(prodottoId: string, tipo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return;
  await supabase.from('avvisi_archiviati').upsert(
    { org_id: orgId, prodotto_id: prodottoId, tipo, archiviato_il: new Date().toISOString() },
    { onConflict: 'org_id,prodotto_id,tipo' },
  );
  revalidatePath('/app');
  revalidatePath('/grafici');
  revalidatePath('/approvvigionamento');
}

export async function archiviaTuttiAction(items: { id: string; tipo: string }[]) {
  if (!items.length) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return;
  const now = new Date().toISOString();
  await supabase.from('avvisi_archiviati').upsert(
    items.map(i => ({ org_id: orgId, prodotto_id: i.id, tipo: i.tipo, archiviato_il: now })),
    { onConflict: 'org_id,prodotto_id,tipo' },
  );
  revalidatePath('/app');
  revalidatePath('/grafici');
  revalidatePath('/approvvigionamento');
  revalidatePath('/avvisi');
}

export async function ripristinaAvvisoAction(prodottoId: string, tipo: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return;
  await supabase.from('avvisi_archiviati')
    .delete()
    .eq('org_id', orgId)
    .eq('prodotto_id', prodottoId)
    .eq('tipo', tipo);
  revalidatePath('/avvisi');
  revalidatePath('/app');
}

export async function azzeraAvvisiAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return;
  await supabase.from('avvisi_archiviati').delete().eq('org_id', orgId);
  revalidatePath('/app');
  revalidatePath('/grafici');
  revalidatePath('/approvvigionamento');
}
