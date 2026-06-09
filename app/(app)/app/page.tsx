import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUserContext } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import { AppHeader } from '@/components/app-header';
import { AutoRefresh } from '@/components/auto-refresh';
import { UoSelector } from '@/components/uo-selector';
import { getUoAttivaId } from '@/lib/uo-cookie';
import { FileText, ClipboardList, BarChart2, Building2, CalendarDays, Users, Gavel } from 'lucide-react';

export const metadata = { title: 'Dashboard' };

const CAT_ICONS: Record<string, string> = {
  terapie:    '💊',
  nutrizioni: '🥗',
  sanitario:  '🩺',
};

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
  ]);

  if (profileRes.error || memberRes.error || !memberRes.data.organizations) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <h1 className="font-display text-2xl font-semibold text-ink mb-2">Configurazione in corso</h1>
          <p className="text-ink-soft text-sm">Il tuo account è stato creato. Ricarica la pagina tra qualche secondo.</p>
        </div>
      </div>
    );
  }

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const [unitaRes, uoAttivaId] = await Promise.all([
    supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome'),
    getUoAttivaId(),
  ]);
  const unita = unitaRes.data ?? [];
  const uoAttiva = unita.find((u: { id: string }) => u.id === uoAttivaId) ?? null;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">
          Benvenuta, {ctx.profile.full_name?.split(' ')[0]}
        </h1>
        <div className="flex items-center gap-3 mb-8">
          <p className="text-ink-soft text-sm">{ctx.organization.name}</p>
          <AutoRefresh />
        </div>

        {/* Selezione unità operativa */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-ink-soft" />
            <h2 className="font-semibold text-ink">Unità Operativa</h2>
            {uoAttiva && <span className="text-xs text-ink-mute">— clicca un'altra per cambiare</span>}
          </div>
          {unita.filter((u: { attiva: boolean }) => u.attiva).length === 0 ? (
            <div className="card text-center py-8">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-ink-mute opacity-30" />
              <p className="text-sm text-ink-mute mb-3">Nessuna unità operativa configurata.</p>
              <Link href="/impostazioni" className="btn-primary text-sm">Vai alle impostazioni</Link>
            </div>
          ) : (
            <UoSelector unita={unita} uoAttivaId={uoAttivaId} backUrl="/app" />
          )}
        </section>

        {/* Sezioni categoria — solo se UO selezionata */}
        {uoAttiva ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-ink">
                Sezioni — <span className="text-forest">{uoAttiva.nome}</span>
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              {(['terapie', 'nutrizioni', 'sanitario'] as const).map((cat) => (
                <Link
                  key={cat}
                  href={`/${cat}`}
                  className="card hover:border-forest/40 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-forest-tint flex items-center justify-center group-hover:bg-forest/10 transition-colors text-xl">
                      {CAT_ICONS[cat]}
                    </div>
                    <h3 className="font-semibold text-ink">{CAT_LABELS[cat]}</h3>
                  </div>
                  <p className="text-ink-mute text-sm">Prodotti, scorte e documenti</p>
                  <p className="text-xs text-forest mt-1 font-medium">{uoAttiva.nome}</p>
                </Link>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <Link href="/calendario" className="card hover:border-forest/40 hover:shadow-sm transition-all group flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-forest-tint flex items-center justify-center shrink-0 group-hover:bg-forest/10">
                  <CalendarDays className="w-5 h-5 text-forest" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Calendario</h3>
                  <p className="text-ink-mute text-sm">Piani fabbisogno salvati</p>
                  <p className="text-xs text-forest mt-0.5 font-medium">{uoAttiva.nome}</p>
                </div>
              </Link>
              <Link href="/grafici" className="card hover:border-forest/40 hover:shadow-sm transition-all group flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-forest-tint flex items-center justify-center shrink-0 group-hover:bg-forest/10">
                  <BarChart2 className="w-5 h-5 text-forest" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Grafici</h3>
                  <p className="text-ink-mute text-sm">Scorte, consumi e analisi</p>
                </div>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/pazienti" className="card hover:border-forest/40 hover:shadow-sm transition-all group flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-forest-tint flex items-center justify-center shrink-0 group-hover:bg-forest/10">
                  <Users className="w-5 h-5 text-forest" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Pazienti ricoverati</h3>
                  <p className="text-ink-mute text-sm">Carica mappa posti letto — OCR per sala</p>
                </div>
              </Link>
              <Link href="/gare" className="card hover:border-purple-300 hover:shadow-sm transition-all group flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 group-hover:bg-purple-100">
                  <Gavel className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Gare d&apos;appalto</h3>
                  <p className="text-ink-mute text-sm">Contratti regionali farmaci e sanitario</p>
                </div>
              </Link>
              <Link href="/approvvigionamento" className="card hover:border-amber/40 hover:shadow-sm transition-all group flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber/10 flex items-center justify-center shrink-0 group-hover:bg-amber/20">
                  <ClipboardList className="w-5 h-5 text-amber" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Approvvigionamento</h3>
                  <p className="text-ink-mute text-sm">Calcola ordini ed esporta in PDF o CSV</p>
                </div>
              </Link>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-mute">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Seleziona un'unità operativa per accedere alle sezioni.</p>
          </div>
        )}
      </main>
    </div>
  );
}
