import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { ApprovvigionamentoView } from '@/components/approvvigionamento-view';
import type { CurrentUserContext } from '@/lib/types';
import type { Prodotto } from '@/lib/prodotti';
import { getUoAttivaId } from '@/lib/uo-cookie';

export const metadata = { title: 'Approvvigionamento' };

export default async function ApprovvigionamentoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes, uoAttivaId] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
    getUoAttivaId(),
  ]);

  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const [{ data: prodottiRaw }, { data: sanitarioOrdini }, { data: unita }] = await Promise.all([
    supabase
      .from('prodotti')
      .select('*')
      .eq('org_id', org.id)
      .in('categoria', ['terapie', 'nutrizioni', 'sanitario', 'economale'])
      .order('principio_attivo', { ascending: true })
      .order('forma_farmaceutica', { ascending: true }),
    uoAttivaId
      ? supabase
          .from('sanitario_ordini')
          .select('prodotto_id, consumo_giornaliero')
          .eq('org_id', org.id)
          .eq('unita_operativa_id', uoAttivaId)
      : Promise.resolve({ data: [] }),
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
  ]);

  const uoAttiva = (unita ?? []).find((u: { id: string }) => u.id === uoAttivaId) ?? null;

  const ordiniMap = new Map<string, number>(
    ((sanitarioOrdini ?? []) as { prodotto_id: string; consumo_giornaliero: number | null }[])
      .map((o) => [o.prodotto_id, o.consumo_giornaliero ?? 0])
  );

  const prodotti: Prodotto[] = (prodottiRaw ?? []).map((p) => ({
    ...p,
    consumo_giornaliero:
      (p.categoria === 'sanitario' || p.categoria === 'economale')
        ? (ordiniMap.get(p.id) ?? 0)
        : (p.consumo_giornaliero ?? 0),
  }));

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita ?? []} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Approvvigionamento</h1>
          <p className="text-ink-soft text-sm mt-1">{org.name}</p>
        </div>
        <ApprovvigionamentoView
          prodotti={prodotti}
          orgName={org.name}
        />
      </main>
    </div>
  );
}
