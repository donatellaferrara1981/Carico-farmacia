import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { GraficiView } from '@/components/grafici-view';
import { AutoRefresh } from '@/components/auto-refresh';
import type { CurrentUserContext } from '@/lib/types';
import { getUoAttivaId } from '@/lib/uo-cookie';

export const metadata = { title: 'Grafici' };

export default async function GraficiPage() {
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

  const [uoAttivaId, { data: prodotti }, { data: documenti }, { data: unita }] = await Promise.all([
    getUoAttivaId(),
    supabase.from('prodotti').select('*').eq('org_id', org.id),
    supabase.from('documenti').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
  ]);

  const uoAttiva = (unita ?? []).find((u: { id: string }) => u.id === uoAttivaId) ?? null;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita ?? []} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Grafici</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-ink-soft text-sm">{org.name}</p>
            <AutoRefresh />
          </div>
        </div>
        <GraficiView
          prodotti={prodotti ?? []}
          documenti={documenti ?? []}
          unita={unita ?? []}
        />
      </main>
    </div>
  );
}
