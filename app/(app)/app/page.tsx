import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUserContext } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import { AppHeader } from '@/components/app-header';
import { AutoRefresh } from '@/components/auto-refresh';
import { UoSelector } from '@/components/uo-selector';
import { getUoAttivaId } from '@/lib/uo-cookie';
import { FileText, ClipboardList, BarChart2, Building2, CalendarDays, Users, Gavel, Microscope, FileBarChart2 } from 'lucide-react';

export const metadata = { title: 'Dashboard' };

const CAT_ICONS: Record<string, string> = {
  terapie:    '💊',
  nutrizioni: '🥗',
  sanitario:  '🩺',
  economale:  '🗂️',
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

  // Conteggio pazienti per la UO attiva
  let numeroPazienti = 0;
  if (uoAttiva) {
    const { count } = await supabase
      .from('pazienti')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('unita_operativa_id', uoAttiva.id);
    numeroPazienti = count ?? 0;
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">
          Benvenuta, {ctx.profile.full_name?.split(' ').at(-1)}
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

        {/* Pazienti — sempre visibile subito dopo la UO */}
        {uoAttiva && (
          <div className="mb-6">
            <Link
              href="/pazienti"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-forest/30 bg-forest/5 hover:bg-forest/10 hover:border-forest/50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-forest" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink text-sm">Pazienti ricoverati</p>
                <p className="text-xs text-ink-mute">Elenco letti · {uoAttiva.nome}</p>
              </div>
              {numeroPazienti > 0 && (
                <div className="flex flex-col items-center bg-forest text-white rounded-lg px-3 py-1 min-w-[48px]">
                  <span className="text-xl font-bold leading-none">{numeroPazienti}</span>
                  <span className="text-[9px] uppercase tracking-wide opacity-80">pz</span>
                </div>
              )}
            </Link>
          </div>
        )}

        {/* Sezioni categoria — solo se UO selezionata */}
        {uoAttiva ? (
          <>
            <p className="text-xs text-ink-mute mb-3 font-medium uppercase tracking-wide">{uoAttiva.nome}</p>

            {/* Categoria principali — griglia compatta */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {(['terapie', 'nutrizioni', 'sanitario', 'economale'] as const).map((cat) => (
                <Link
                  key={cat}
                  href={`/${cat}`}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-forest/40 hover:bg-forest/5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-forest-tint flex items-center justify-center group-hover:bg-forest/10 transition-colors text-2xl">
                    {CAT_ICONS[cat]}
                  </div>
                  <span className="text-xs font-semibold text-ink">{CAT_LABELS[cat]}</span>
                </Link>
              ))}
            </div>

            {/* Altre sezioni — griglia compatta 3 colonne */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Link href="/calendario" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-forest/40 hover:bg-forest/5 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-forest-tint flex items-center justify-center group-hover:bg-forest/10">
                  <CalendarDays className="w-5 h-5 text-forest" />
                </div>
                <span className="text-xs font-semibold text-ink">Calendario</span>
              </Link>
              <Link href="/grafici" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-forest/40 hover:bg-forest/5 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-forest-tint flex items-center justify-center group-hover:bg-forest/10">
                  <BarChart2 className="w-5 h-5 text-forest" />
                </div>
                <span className="text-xs font-semibold text-ink">Grafici</span>
              </Link>
              <Link href="/approvvigionamento" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-amber/40 hover:bg-amber/5 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center group-hover:bg-amber/20">
                  <ClipboardList className="w-5 h-5 text-amber" />
                </div>
                <span className="text-xs font-semibold text-ink text-center">Ordini</span>
              </Link>
              <Link href="/gare" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-purple-300 hover:bg-purple-50 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100">
                  <Gavel className="w-5 h-5 text-purple-700" />
                </div>
                <span className="text-xs font-semibold text-ink">Gare</span>
              </Link>
              <Link href="/germ-alert" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-red-200 hover:bg-red-50 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100">
                  <Microscope className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xs font-semibold text-ink">Germ Alert</span>
              </Link>
              <Link href="/report-paca" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-line bg-bg-card hover:border-amber/40 hover:bg-amber/5 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center group-hover:bg-amber/20">
                  <FileBarChart2 className="w-5 h-5 text-amber" />
                </div>
                <span className="text-xs font-semibold text-ink text-center">Report PACA</span>
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
