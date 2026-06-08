import Link from 'next/link';
import { Suspense } from 'react';
import { Bell, LogOut, ClipboardList, Settings, BarChart2, CalendarDays, Users } from 'lucide-react';
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
        <Link href="/app" className="shrink-0">
          <Logo size={32} />
        </Link>

        {/* UO attiva — desktop switcher */}
        {uoAttiva && (
          <UoSwitcher uoAttiva={uoAttiva} unita={unita} />
        )}

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1 flex-1">
          {[
            { href: '/grafici',            label: 'Grafici',    Icon: BarChart2     },
            { href: '/calendario',         label: 'Calendario', Icon: CalendarDays  },
            { href: '/pazienti',           label: 'Pazienti',   Icon: Users         },
            { href: '/approvvigionamento', label: 'Ordini',     Icon: ClipboardList },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors text-sm font-medium"
            >
              <Icon className="w-4 h-4" />
              {label}
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

          <span className="text-sm text-ink-soft hidden md:block max-w-[120px] truncate">
            {ctx.profile.full_name}
          </span>

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
