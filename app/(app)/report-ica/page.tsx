import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { ReportIcaView } from '@/components/report-ica-view';
import type { CurrentUserContext } from '@/lib/types';
import { getUoAttivaId } from '@/lib/uo-cookie';

export const metadata = { title: 'Report ICA' };

export default async function ReportIcaPage() {
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

  const { data: esami } = await supabase
    .from('ica_esami')
    .select('*')
    .eq('org_id', org.id)
    .order('data_invio', { ascending: false });

  // Relazioni archiviate (senza il contenuto HTML, che si carica solo all'apertura)
  const { data: relazioni } = await supabase
    .from('relazioni_archiviate')
    .select('id, titolo, periodo, created_at, created_by_nome')
    .eq('org_id', org.id)
    .eq('tipo', 'ica')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Report ICA</h1>
          <p className="text-ink-soft text-sm mt-1">
            {org.name} — Infezioni Correlate all'Assistenza · sorveglianza microbiologica
          </p>
        </div>
        <ReportIcaView
          esami={esami ?? []}
          orgId={org.id}
          orgName={org.name}
          userName={ctx.profile.full_name ?? ''}
          relazioni={relazioni ?? []}
        />
      </main>
    </div>
  );
}
