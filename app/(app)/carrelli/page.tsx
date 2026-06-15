import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { CarrelliView } from '@/components/carrelli-view';
import { getUoAttivaId } from '@/lib/uo-cookie';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Carrelli di Emergenza' };

export default async function CarrelliPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes, uoAttivaId] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
    getUoAttivaId(),
  ]);

  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const [unitaRes, carrelliRes] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    supabase
      .from('carrelli_emergenza')
      .select('*, articoli_carrello(id, data_alert)')
      .eq('org_id', org.id)
      .order('nome'),
  ]);

  const unita = unitaRes.data ?? [];
  const uoAttiva = unita.find((u: { id: string }) => u.id === uoAttivaId) ?? null;
  const carrelli = carrelliRes.data ?? [];

  const canEdit = ctx.role === 'admin' || ctx.role === 'collaboratore';

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Carrelli di Emergenza</h1>
          <p className="text-ink-soft text-sm mt-1">{org.name}</p>
        </div>
        <CarrelliView
          carrelli={carrelli}
          unita={unita}
          orgId={org.id}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
