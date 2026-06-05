import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { CalendarioView } from '@/components/calendario-view';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Calendario piani' };

export default async function CalendarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
  ]);
  if (memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const { data: piani } = await supabase
    .from('piani_fabbisogno')
    .select('*')
    .eq('org_id', org.id)
    .order('data_inizio', { ascending: false });

  const canEdit = ctx.role === 'admin' || ctx.role === 'collaboratore';

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink mt-2 mb-1">Calendario piani</h1>
        <p className="text-ink-soft text-sm mb-8">Piani fabbisogno salvati per categoria e periodo</p>
        <CalendarioView piani={piani ?? []} canEdit={canEdit} />
      </main>
    </div>
  );
}
