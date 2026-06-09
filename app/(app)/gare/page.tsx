import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { GareView, type Gara, type ProdottoBase } from '@/components/gare-view';
import { getUoAttivaId } from '@/lib/uo-cookie';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Gare d\'appalto' };

export default async function GarePage() {
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

  // Carica gare + tutti i prodotti dell'org (farmaci + sanitario)
  const [gareRes, prodottiRes] = await Promise.all([
    supabase
      .from('gare_appalto')
      .select('*')
      .eq('org_id', org.id)
      .order('data_scadenza', { ascending: true, nullsFirst: false }),
    supabase
      .from('prodotti')
      .select('id, principio_attivo, forma_farmaceutica, dosaggio, categoria, quantita')
      .eq('org_id', org.id)
      .order('principio_attivo'),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Gare d&apos;appalto</h1>
          <p className="text-ink-soft text-sm mt-1">Regione Sicilia · {org.name} · {gareRes.data?.length ?? 0} gare registrate</p>
        </div>
        <GareView
          gare={(gareRes.data ?? []) as Gara[]}
          prodotti={(prodottiRes.data ?? []) as ProdottoBase[]}
          orgName={org.name}
        />
      </main>
    </div>
  );
}
