import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { ProdottiView } from '@/components/prodotti-view';
import { SanitarioView } from '@/components/sanitario-view';
import { AutoRefresh } from '@/components/auto-refresh';
import type { CurrentUserContext, CategoriaArticolo } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import type { ProdottoConDocumenti } from '@/lib/prodotti';
import { BackButton } from '@/components/back-button';
import { getUoAttivaId } from '@/lib/uo-cookie';
import { DocumentiList } from '@/components/documenti-list';
import { UploadButton } from '@/components/upload-button';
import { SanitarioToolbar } from '@/components/sanitario-toolbar';

const VALIDE: CategoriaArticolo[] = ['terapie', 'nutrizioni', 'sanitario', 'economale'];

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

  const prodottiQuery = supabase
    .from('prodotti')
    .select('*, documenti(*)')
    .eq('org_id', org.id)
    .eq('categoria', cat)
    .order('principio_attivo', { ascending: true })
    .order('forma_farmaceutica', { ascending: true });

  const [unitaRes, prodottiRawRes, docsLiberiRes, sanitarioOrdiniRes, pazientiRes, terapiePazRes] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    prodottiQuery,
    supabase
      .from('documenti')
      .select('*')
      .eq('org_id', org.id)
      .eq('categoria', cat)
      .eq('unita_operativa_id', uoAttivaId)
      .is('prodotto_id', null)
      .order('created_at', { ascending: false }),
    (cat === 'sanitario' || cat === 'economale')
      ? supabase
          .from('sanitario_ordini')
          .select('prodotto_id, consumo_giornaliero, quantita_consegnata, consumo_medio')
          .eq('org_id', org.id)
          .eq('unita_operativa_id', uoAttivaId)
      : Promise.resolve({ data: [] }),
    cat === 'terapie'
      ? supabase.from('pazienti').select('id, nominativo, sala, numero_letto').eq('org_id', org.id).eq('unita_operativa_id', uoAttivaId).order('numero_letto')
      : Promise.resolve({ data: [] }),
    cat === 'terapie'
      ? supabase.from('terapie_pazienti').select('paziente_id, principio_attivo, dosaggio, tipo').eq('org_id', org.id).eq('tipo', 'terapia')
      : Promise.resolve({ data: [] }),
  ]);

  const unita = unitaRes.data ?? [];
  const uoAttiva = unita.find((u: { id: string }) => u.id === uoAttivaId) ?? null;

  // Per sanitario: sovrapponi le quantità private della UO attiva
  type OrdineUO = { prodotto_id: string; consumo_giornaliero: number | null; quantita_consegnata: number | null; consumo_medio: number | null };
  const ordiniMap = new Map<string, OrdineUO>(
    ((sanitarioOrdiniRes.data ?? []) as OrdineUO[]).map((o) => [o.prodotto_id, o])
  );

  const isSanitario = cat === 'sanitario' || cat === 'economale';
  const prodotti: ProdottoConDocumenti[] = (prodottiRawRes.data ?? []).map((p) => {
    const ordine = ordiniMap.get(p.id);
    return {
      ...p,
      // Per sanitario/economale usa i valori per-UO; per terapie/nutrizioni mantieni il valore del catalogo
      consumo_giornaliero: isSanitario ? (ordine?.consumo_giornaliero ?? 0) : (p.consumo_giornaliero ?? 0),
      quantita_consegnata: ordine?.quantita_consegnata ?? null,
      consumo_medio: ordine?.consumo_medio ?? null,
      documenti: (p.documenti ?? []).filter((d: { prodotto_id: string | null }) => d.prodotto_id === p.id),
    };
  });

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
        {(cat === 'sanitario' || cat === 'economale') ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <UploadButton categoria={cat} orgId={org.id} />
              <SanitarioToolbar orgId={org.id} hasItems={prodotti.length > 0} categoria={cat} />
            </div>
            <SanitarioView prodotti={prodotti} orgId={org.id} canEdit={canEdit} categoria={cat} />
            {(docsLiberiRes.data ?? []).length > 0 && (
              <div>
                <p className="text-xs text-ink-mute font-medium uppercase tracking-wide mb-2">Documenti</p>
                <DocumentiList
                  documenti={docsLiberiRes.data ?? []}
                  orgId={org.id}
                  categoria={cat}
                  canDelete={canEdit}
                />
              </div>
            )}
          </div>
        ) : (
          <ProdottiView
            prodotti={prodotti}
            docsLiberi={docsLiberiRes.data ?? []}
            orgId={org.id}
            categoria={cat}
            canEdit={canEdit}
            uoAttivaId={uoAttivaId}
            pazienti={cat === 'terapie' ? (pazientiRes.data ?? []) : []}
            terapiePazienti={cat === 'terapie' ? (terapiePazRes.data ?? []) : []}
          />
        )}
      </main>
    </div>
  );
}
