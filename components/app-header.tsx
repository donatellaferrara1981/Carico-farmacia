import Link from 'next/link';
import { Suspense } from 'react';
import { ReportPacaIcon } from '@/components/report-paca-icon';
import { CalendarioIcon } from '@/components/calendario-icon';
import { GareIcon } from '@/components/gare-icon';
import { GraficiIcon } from '@/components/grafici-icon';
import { CarrelloIcon } from '@/components/carrello-icon';
import { Bell, LogOut, ClipboardList, Settings, CalendarDays, Users, Activity } from 'lucide-react';
import { Logo } from './logo';
import { RoleBadge } from './role-badge';
import { AlertBellServer } from './alert-bell-server';
import { MobileMenu } from './mobile-menu';
import { UoSwitcher } from './uo-switcher';
import { logoutAction } from '@/app/(auth)/actions';
import type { CurrentUserContext } from '@/lib/types';

interface UnitaOperativa { id: string; nome: string; attiva: boolean; }

interface Props {
  ctx: CurrentUserContext;
  uoAttiva?: UnitaOperativa | null;
  unita?: UnitaOperativa[];
}

export function AppHeader({ ctx, uoAttiva, unita = [] }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/app">
            <Logo size={32} />
          </Link>
        </div>

        {/* UO attiva — desktop switcher + Pazienti subito dopo */}
        <div className="hidden sm:flex items-center gap-2">
          {uoAttiva && (
            <UoSwitcher uoAttiva={uoAttiva} unita={unita} />
          )}
          <Link
            href="/pazienti"
            title="Pazienti"
            className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors"
          >
            <Users className="w-4 h-4" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-0.5 rounded bg-ink text-bg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Pazienti
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1 flex-1">
          {[
            { href: '/grafici',            label: 'Grafici',     Icon: GraficiIcon   },
            { href: '/calendario',         label: 'Calendario',  Icon: CalendarioIcon },
            { href: '/gare',               label: 'Gare',        Icon: GareIcon      },
            { href: '/approvvigionamento', label: 'Ordini',      Icon: ClipboardList },
            { href: '/report-paca',        label: 'Report PACA', Icon: ReportPacaIcon },
            { href: '/carrelli',           label: 'Carrelli',    Icon: CarrelloIcon  },
            { href: '/report-ica',         label: 'Report ICA',  Icon: Activity      },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className="group relative flex items-center px-2.5 py-1.5 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors"
            >
              <Icon className={Icon === CarrelloIcon || Icon === ReportPacaIcon || Icon === GareIcon || Icon === GraficiIcon || Icon === CalendarioIcon ? 'w-6 h-6' : 'w-4 h-4'} />
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-0.5 rounded bg-ink text-bg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/impostazioni" className="p-2 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors" title="Impostazioni">
            <Settings className="w-4 h-4" />
          </Link>

          <Suspense fallback={<div className="p-2 text-ink-soft"><Bell className="w-4 h-4 opacity-40" /></div>}>
            <AlertBellServer orgId={ctx.organization.id} />
          </Suspense>

          <RoleBadge role={ctx.role} />

          <form action={logoutAction}>
            <button type="submit" className="btn-ghost p-2" aria-label="Esci">
              <LogOut className="w-4 h-4" />
            </button>
          </form>

          <MobileMenu uoAttiva={uoAttiva} unita={unita} />
        </div>
      </div>
    </header>
  );
}
