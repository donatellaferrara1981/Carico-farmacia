import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUserContext } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import { AppHeader } from '@/components/app-header';
import { UoSelector } from '@/components/uo-selector';
import { getUoAttivaId } from '@/lib/uo-cookie';
import { FileText, Building2, Users } from 'lucide-react';

export const metadata = { title: 'Dashboard' };

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

  // Icona del tasto "Pazienti ricoverati" in base all'unità operativa attiva
  const nomeUo = (uoAttiva?.nome ?? '').toLowerCase();
  const iconaPazienti =
    /gca\s*1/.test(nomeUo) ? '/icone/pazienti-gca1.png'
    : /spinale/.test(nomeUo) ? '/icone/pazienti-spinale.png'
    : /gca\s*3/.test(nomeUo) ? '/icone/pazienti-gca3.png'
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita} />
      <main className="max-w-2xl mx-auto px-3 py-3">
        {/* Selezione unità operativa */}
        <section className="mb-4">
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
              {iconaPazienti ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconaPazienti} alt="" className="w-12 h-12 rounded-xl shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-forest/10 flex items-center justify-center shrink-0 group-hover:bg-forest/20 transition-colors">
                  <Users className="w-6 h-6 text-forest" />
                </div>
              )}
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

            {/* Sezioni: tutte visibili in una schermata da cellulare (4 colonne x 3 righe) */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { href: '/carico',             src: '/icone/carico.png',      label: 'Carico farmacia' },
                { href: '/sanitario',          src: '/icone/sanitario.png',   label: 'Sanitario' },
                { href: '/economale',          src: '/icone/economale.png',   label: 'Economale' },
                { href: '/approvvigionamento', src: '/icone/ordini.png',      label: 'Ordini' },
                { href: '/calendario',         src: '/icone/calendario.png',  label: 'Calendario' },
                { href: '/grafici',            src: '/icone/grafici.png',     label: 'Grafici' },
                { href: '/gare',               src: '/icone/gare.png',        label: 'Gare' },
                { href: '/germ-alert',         src: '/icone/germ-alert.png',  label: 'Germ Alert' },
                { href: '/report-paca',        src: '/icone/report-paca.png', label: 'Report PACA' },
                { href: '/archivio',           src: '/icone/archivio.png',    label: 'Archivio' },
                { href: '/carrelli',           src: '/icone/carrelli-v2.png',    label: 'Carrelli' },
                { href: '/prontuario',         src: '/icone/terapie.png',     label: 'Prontuario' },
              ].map(({ href, src, label }) => (
                <Link key={href} href={href}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-2xl border border-line bg-bg-card hover:border-forest/40 hover:bg-forest/5 active:scale-95 transition-all">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full aspect-square max-w-[84px] rounded-2xl object-contain" />
                  <span className="text-[11px] sm:text-sm font-medium text-ink text-center leading-tight min-h-[2.2em] flex items-center">{label}</span>
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
