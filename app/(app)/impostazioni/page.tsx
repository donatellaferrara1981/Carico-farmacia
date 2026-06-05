import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { UnitaOperativeManager } from '@/components/unita-operative-manager';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Impostazioni' };

export default async function ImpostazioniPage() {
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

  const { data: unita } = await supabase
    .from('unita_operative')
    .select('*')
    .eq('org_id', org.id)
    .order('nome');

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">Impostazioni</h1>
        <p className="text-ink-soft text-sm mb-8">{org.name}</p>

        <UnitaOperativeManager
          unita={unita ?? []}
          orgId={org.id}
          canEdit={ctx.role === 'admin' || ctx.role === 'collaboratore'}
        />
      </main>
    </div>
  );
}
