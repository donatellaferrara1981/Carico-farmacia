import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { AutoRefresh } from '@/components/auto-refresh';
import { ConsumoGiornalieroView } from '@/components/consumo-giornaliero-view';
import { UploadButton } from '@/components/upload-button';
import { DocumentiList } from '@/components/documenti-list';
import { getUoAttivaId } from '@/lib/uo-cookie';
import type { CurrentUserContext } from '@/lib/types';

export const metadata = { title: 'Consumo giornaliero' };

export default async function ConsumoGiornalieroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes, uoAttivaId] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
    getUoAttivaId(),
  ]);
  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');
  if (!uoAttivaId) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const [unitaRes, prodRes, tpRes, pazRes, docsRes] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    supabase
      .from('prodotti')
      .select('id, categoria, principio_attivo, nome_commerciale, forma_farmaceutica, dosaggio, consumo_giornaliero, nominativa, note')
      .eq('org_id', org.id)
      .in('categoria', ['terapie', 'nutrizioni']),
    supabase
      .from('terapie_pazienti')
      .select('paziente_id, prodotto_id, principio_attivo, dosaggio, posologia, tipo')
      .eq('org_id', org.id)
      .eq('tipo', 'terapia'),
    supabase
      .from('pazienti')
      .select('id, nominativo, numero_letto, sala')
      .eq('org_id', org.id)
      .eq('unita_operativa_id', uoAttivaId),
    supabase
      .from('documenti')
      .select('*')
      .eq('org_id', org.id)
      .eq('categoria', 'terapie')
      .eq('unita_operativa_id', uoAttivaId)
      .is('prodotto_id', null)
      .order('created_at', { ascending: false }),
  ]);

  const unita = unitaRes.data ?? [];
  const uoAttiva = unita.find((u: { id: string }) => u.id === uoAttivaId) ?? null;
  const canEdit = ctx.role === 'admin' || ctx.role === 'collaboratore';

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Consumo giornaliero</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-ink-soft text-sm">{org.name}</p>
            {uoAttiva && <span className="text-xs font-medium text-forest bg-forest/10 px-2 py-0.5 rounded-full">{uoAttiva.nome}</span>}
            <AutoRefresh />
          </div>
        </div>

        <section className="card mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Carica intero consumo giornaliero</h2>
              <p className="text-xs text-ink-mute mt-0.5">
                Carica il file, poi premi «Estrai» sul documento: i farmaci vengono letti e abbinati ai pazienti.
              </p>
            </div>
            {canEdit && <UploadButton categoria="terapie" orgId={org.id} />}
          </div>
          {(docsRes.data ?? []).length > 0 && (
            <div className="mt-4">
              <DocumentiList documenti={docsRes.data ?? []} orgId={org.id} categoria="terapie" canDelete={canEdit} />
            </div>
          )}
        </section>

        <ConsumoGiornalieroView
          prodotti={prodRes.data ?? []}
          terapie={tpRes.data ?? []}
          pazienti={pazRes.data ?? []}
          orgName={org.name}
          uoNome={uoAttiva?.nome ?? ''}
        />
      </main>
    </div>
  );
}
