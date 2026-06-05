import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { UnitaOperativeManager } from '@/components/unita-operative-manager';
import { AlertConfigForm } from '@/components/alert-config-form';
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

  const [unitaRes, alertRes] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    supabase.from('alert_config').select('*').eq('org_id', org.id).maybeSingle(),
  ]);
  const unita = unitaRes.data;
  const alertConfig = alertRes.data;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink mt-2 mb-1">Impostazioni</h1>
        <p className="text-ink-soft text-sm mb-8">{org.name}</p>

        <UnitaOperativeManager
          unita={unita ?? []}
          orgId={org.id}
          canEdit={ctx.role === 'admin' || ctx.role === 'collaboratore'}
        />

        <div className="mt-10">
          <h2 className="font-semibold text-ink mb-1">Alert e notifiche email</h2>
          <p className="text-xs text-ink-mute mb-4">
            Ricevi email automatiche per scorte in esaurimento, scadenze e promemoria di riordino.
          </p>
          <AlertConfigForm
            orgId={org.id}
            config={alertConfig}
            defaultEmail={ctx.user.email}
          />
        </div>
      </main>
    </div>
  );
}
