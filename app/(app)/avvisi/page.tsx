import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { AvvisiArchiviatiView } from '@/components/avvisi-archiviati-view';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Avvisi archiviati' };

export default async function AvvisiPage() {
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

  // Avvisi archiviati con dati del prodotto
  const { data: archiviatiRaw } = await supabase
    .from('avvisi_archiviati')
    .select('prodotto_id, tipo, archiviato_il, prodotti(principio_attivo, nome_commerciale, dosaggio, categoria)')
    .eq('org_id', org.id)
    .order('archiviato_il', { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const archiviati = (archiviatiRaw ?? []).map((r: any) => ({
    prodotto_id: r.prodotto_id,
    tipo: r.tipo,
    archiviato_il: r.archiviato_il,
    prodotti: Array.isArray(r.prodotti) ? r.prodotti[0] ?? null : r.prodotti ?? null,
  }));

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Avvisi archiviati</h1>
          <p className="text-ink-soft text-sm mt-1">Notifiche che hai silenziato · puoi ripristinarle in qualsiasi momento</p>
        </div>
        <AvvisiArchiviatiView items={archiviati ?? []} />
      </main>
    </div>
  );
}
