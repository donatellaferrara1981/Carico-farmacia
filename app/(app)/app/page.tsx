import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUserContext } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import { AppHeader } from '@/components/app-header';
import { AutoRefresh } from '@/components/auto-refresh';
import { UoSelector } from '@/components/uo-selector';
import { getUoAttivaId } from '@/lib/uo-cookie';
import { FileText, ClipboardList, BarChart2, Building2, CalendarDays, Users, Gavel, Microscope, FileBarChart2, ShoppingCart } from 'lucide-react';

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
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">
              {ctx.profile.full_name?.split(' ').at(-1)}
            </h1>
            <p className="text-xs text-ink-mute">{ctx.organization.name}</p>
          </div>
        </div>

        {/* Selezione unità operativa */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-3.5 h-3.5 text-ink-soft" />
            <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Unità Operativa</h2>
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

        {/* Sezioni — solo se UO selezionata */}
        {uoAttiva ? (
          <>
            {/* Pazienti — link prominente con contatore */}
            <Link
              href="/pazienti"
              className="flex items-center gap-3 px-3 py-2.5 mb-4 rounded-xl border border-forest/30 bg-forest/5 hover:bg-forest/10 hover:border-forest/50 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center shrink-0 group-hover:bg-forest/20 transition-colors">
                <Users className="w-4 h-4 text-forest" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">Pazienti ricoverati</p>
                <p className="text-xs text-ink-mute truncate">{uoAttiva.nome}</p>
              </div>
              {numeroPazienti > 0 && (
                <span className="text-sm font-bold text-forest bg-forest/10 rounded-lg px-2.5 py-1 shrink-0">
                  {numeroPazienti} <span className="text-[10px] font-normal opacity-70">pz</span>
                </span>
              )}
            </Link>

            {/* Barra icone — tutte le sezioni */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { href: '/terapie',           icon: CAT_ICONS['terapie'],    label: 'Terapie',      emoji: true,  color: 'hover:bg-forest/10 hover:border-forest/30' },
                { href: '/nutrizioni',         icon: CAT_ICONS['nutrizioni'], label: 'Nutrizioni',   emoji: true,  color: 'hover:bg-forest/10 hover:border-forest/30' },
                { href: '/sanitario',          icon: CAT_ICONS['sanitario'],  label: 'Sanitario',    emoji: true,  color: 'hover:bg-forest/10 hover:border-forest/30' },
                { href: '/economale',          icon: CAT_ICONS['economale'],  label: 'Economale',    emoji: true,  color: 'hover:bg-forest/10 hover:border-forest/30' },
              ] as const).map(({ href, icon, label, color }) => (
                <Link key={href} href={href} title={label}
                  className={`group relative flex items-center justify-center w-11 h-11 rounded-xl border border-line bg-bg-card transition-all text-xl ${color}`}>
                  {icon}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded bg-ink text-bg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {label}
                  </span>
                </Link>
              ))}

              <div className="w-px h-6 bg-line mx-0.5" />

              {([
                { href: '/calendario',         Icon: CalendarDays,   label: 'Calendario',   color: 'text-forest hover:bg-forest/10 hover:border-forest/30' },
                { href: '/grafici',            Icon: BarChart2,      label: 'Grafici',       color: 'text-forest hover:bg-forest/10 hover:border-forest/30' },
                { href: '/approvvigionamento', Icon: ClipboardList,  label: 'Ordini',        color: 'text-amber hover:bg-amber/10 hover:border-amber/30' },
                { href: '/gare',               Icon: Gavel,          label: 'Gare',          color: 'text-purple-600 hover:bg-purple-50 hover:border-purple-200' },
                { href: '/germ-alert',         Icon: Microscope,     label: 'Germ Alert',    color: 'text-red-600 hover:bg-red-50 hover:border-red-200' },
                { href: '/report-paca',        Icon: FileBarChart2,  label: 'Report PACA',   color: 'text-amber hover:bg-amber/10 hover:border-amber/30' },
                { href: '/carrelli',           Icon: ShoppingCart,   label: 'Carrelli',      color: 'text-red-600 hover:bg-red-50 hover:border-red-200' },
              ] as const).map(({ href, Icon, label, color }) => (
                <Link key={href} href={href} title={label}
                  className={`group relative flex items-center justify-center w-11 h-11 rounded-xl border border-line bg-bg-card transition-all ${color}`}>
                  <Icon className="w-5 h-5" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded bg-ink text-bg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-mute">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Seleziona un&apos;unità operativa per accedere alle sezioni.</p>
          </div>
        )}
      </main>
    </div>
  );
}
