import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { ProntuarioView } from '@/components/prontuario-view';
import { caricaCatalogoProntuario } from '@/lib/prontuario';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Prontuario' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function ProntuarioPage() {
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
  const voci = await caricaCatalogoProntuario(supabase, org.id);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
        <BackButton />
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink mt-2">Prontuario farmaceutico</h1>
        <p className="text-ink-soft text-sm mt-1">{org.name} · si aggiorna da solo con il catalogo terapie</p>
        <ProntuarioView voci={voci} />
      </main>
    </div>
  );
}
