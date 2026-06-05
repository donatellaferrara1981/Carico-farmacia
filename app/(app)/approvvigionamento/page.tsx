import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { ApprovvigionamentoView } from '@/components/approvvigionamento-view';
import type { CurrentUserContext } from '@/lib/types';
import type { Prodotto } from '@/lib/prodotti';

export const metadata = { title: 'Approvvigionamento' };

export default async function ApprovvigionamentoPage() {
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

  const { data: prodotti } = await supabase
    .from('prodotti')
    .select('*')
    .eq('org_id', org.id)
    .order('principio_attivo', { ascending: true })
    .order('forma_farmaceutica', { ascending: true });

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold text-ink">Approvvigionamento</h1>
          <p className="text-ink-soft text-sm mt-1">{org.name}</p>
        </div>
        <ApprovvigionamentoView
          prodotti={(prodotti ?? []) as Prodotto[]}
          orgName={org.name}
        />
      </main>
    </div>
  );
}
