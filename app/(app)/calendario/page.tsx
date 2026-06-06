import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { CalendarioView } from '@/components/calendario-view';
import type { CurrentUserContext } from '@/lib/types';
import { getUoAttivaId } from '@/lib/uo-cookie';

export const metadata = { title: 'Calendario piani' };

export default async function CalendarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes, uoAttivaId] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
    getUoAttivaId(),
  ]);
  if (memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const [unitaRes, pianiRes] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    supabase
      .from('piani_fabbisogno')
      .select('*')
      .eq('org_id', org.id)
      .eq('unita_operativa_id', uoAttivaId ?? '')
      .order('data_inizio', { ascending: false }),
  ]);

  const unita = unitaRes.data ?? [];
  const uoAttiva = unita.find((u: { id: string }) => u.id === uoAttivaId) ?? null;
  const canEdit = ctx.role === 'admin' || ctx.role === 'collaboratore';

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink mt-2 mb-1">Calendario piani</h1>
        <p className="text-ink-soft text-sm mb-8">Piani fabbisogno salvati per categoria e periodo</p>
        <CalendarioView piani={pianiRes.data ?? []} canEdit={canEdit} />
      </main>
    </div>
  );
}
