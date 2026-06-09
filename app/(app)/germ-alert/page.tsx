import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { GermAlertView, type GermAlert } from '@/components/germ-alert-view';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Germ Alert' };

export default async function GermAlertPage() {
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

  const { data: alertsRaw } = await supabase
    .from('germ_alert')
    .select('id, germe, fonte_campione, data_rilevamento, sala, numero_letto, nominativo, sensibile, resistente, intermedio, note, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false });

  const alerts: GermAlert[] = (alertsRaw ?? []) as GermAlert[];

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Germ Alert</h1>
          <p className="text-ink-soft text-sm mt-1">Referti microbiologici · {org.name}</p>
        </div>
        <GermAlertView alerts={alerts} orgId={org.id} />
      </main>
    </div>
  );
}
