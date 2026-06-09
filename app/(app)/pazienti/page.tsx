import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { PazientiView, type Paziente, type TerapiaPaziente, type ProdottoSuggestion } from '@/components/pazienti-view';
import { getUoAttivaId } from '@/lib/uo-cookie';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Pazienti ricoverati' };

export default async function PazientiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
  ]);

  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const uoAttivaId = await getUoAttivaId();

  // Carica UO attiva
  let uoNome: string | null = null;
  if (uoAttivaId) {
    const { data: uo } = await supabase
      .from('unita_operative')
      .select('nome')
      .eq('id', uoAttivaId)
      .single();
    uoNome = uo?.nome ?? null;
  }

  // Carica pazienti per questa org + UO
  const query = supabase
    .from('pazienti')
    .select('*')
    .eq('org_id', org.id)
    .order('sala')
    .order('numero_letto');
  if (uoAttivaId) query.eq('unita_operativa_id', uoAttivaId);

  const [{ data: pazientiRaw }, { data: terapieRaw }, { data: prodottiRaw }] = await Promise.all([
    query,
    supabase.from('terapie_pazienti').select('*').eq('org_id', org.id),
    supabase.from('prodotti').select('id, principio_attivo, dosaggio').eq('org_id', org.id).order('principio_attivo'),
  ]);

  // Join terapie onto pazienti
  const terapieByPaziente: Record<string, TerapiaPaziente[]> = {};
  for (const t of terapieRaw ?? []) {
    if (!terapieByPaziente[t.paziente_id]) terapieByPaziente[t.paziente_id] = [];
    terapieByPaziente[t.paziente_id].push({
      id: t.id,
      principio_attivo: t.principio_attivo,
      dosaggio: t.dosaggio ?? null,
      posologia: t.posologia ?? null,
    });
  }

  const pazienti: Paziente[] = (pazientiRaw ?? []).map((p) => ({
    ...(p as Paziente),
    terapie: terapieByPaziente[p.id] ?? [],
  }));

  const prodotti: ProdottoSuggestion[] = (prodottiRaw ?? []).map((p) => ({
    id: p.id,
    principio_attivo: p.principio_attivo,
    dosaggio: p.dosaggio ?? null,
  }));

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Pazienti ricoverati</h1>
          <p className="text-ink-soft text-sm mt-1">
            {uoNome ? `${org.name} · ${uoNome}` : org.name}
          </p>
        </div>
        <PazientiView
          pazienti={pazienti}
          orgId={org.id}
          orgName={org.name}
          uoNome={uoNome}
          prodotti={prodotti}
        />
      </main>
    </div>
  );
}
