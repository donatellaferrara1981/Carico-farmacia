import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { ProdottiView } from '@/components/prodotti-view';
import { AutoRefresh } from '@/components/auto-refresh';
import type { CurrentUserContext, CategoriaArticolo } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import type { ProdottoConDocumenti } from '@/lib/prodotti';
import { BackButton } from '@/components/back-button';
import { getUoAttivaId } from '@/lib/uo-cookie';

const VALIDE: CategoriaArticolo[] = ['terapie', 'nutrizioni', 'sanitario'];

export async function generateMetadata({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  return { title: CAT_LABELS[categoria as CategoriaArticolo] ?? categoria };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  if (!VALIDE.includes(categoria as CategoriaArticolo)) notFound();
  const cat = categoria as CategoriaArticolo;

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

  if (!uoAttivaId) redirect('/app');

  const [unitaRes, prodottiRawRes, docsLiberiRes] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    supabase
      .from('prodotti')
      .select('*, documenti(*)')
      .eq('org_id', org.id)
      .eq('categoria', cat)
      .eq('unita_operativa_id', uoAttivaId)
      .order('principio_attivo', { ascending: true })
      .order('forma_farmaceutica', { ascending: true }),
    supabase
      .from('documenti')
      .select('*')
      .eq('org_id', org.id)
      .eq('categoria', cat)
      .eq('unita_operativa_id', uoAttivaId)
      .is('prodotto_id', null)
      .order('created_at', { ascending: false }),
  ]);

  const unita = unitaRes.data ?? [];
  const uoAttiva = unita.find((u: { id: string }) => u.id === uoAttivaId) ?? null;

  const prodotti: ProdottoConDocumenti[] = (prodottiRawRes.data ?? []).map((p) => ({
    ...p,
    documenti: (p.documenti ?? []).filter((d: { prodotto_id: string | null }) => d.prodotto_id === p.id),
  }));

  const canEdit = ctx.role === 'admin' || ctx.role === 'collaboratore';

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">{CAT_LABELS[cat]}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-ink-soft text-sm">{org.name}</p>
            {uoAttiva && <span className="text-xs font-medium text-forest bg-forest/10 px-2 py-0.5 rounded-full">{uoAttiva.nome}</span>}
            <AutoRefresh />
          </div>
        </div>
        <ProdottiView
          prodotti={prodotti}
          docsLiberi={docsLiberiRes.data ?? []}
          orgId={org.id}
          categoria={cat}
          canEdit={canEdit}
          uoAttivaId={uoAttivaId}
        />
      </main>
    </div>
  );
}
