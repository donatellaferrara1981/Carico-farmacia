import Link from 'next/link';
import { Suspense } from 'react';
import { Bell } from 'lucide-react';
import { Logo } from './logo';
import { RoleBadge } from './role-badge';
import { AlertBellServer } from './alert-bell-server';
import { logoutAction } from '@/app/(auth)/actions';
import { LogOut, ClipboardList, Settings, BarChart2, CalendarDays, Users } from 'lucide-react';
import type { CurrentUserContext } from '@/lib/types';

export function AppHeader({ ctx }: { ctx: CurrentUserContext }) {
  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/app">
          <Logo size={32} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/grafici"
            className="btn-ghost py-1.5 px-3 text-sm hidden sm:flex items-center gap-1.5"
          >
            <BarChart2 className="w-4 h-4" />
            Grafici
          </Link>
          <Link
            href="/calendario"
            className="btn-ghost py-1.5 px-3 text-sm hidden sm:flex items-center gap-1.5"
          >
            <CalendarDays className="w-4 h-4" />
            Calendario
          </Link>
          <Link
            href="/pazienti"
            className="btn-ghost py-1.5 px-3 text-sm hidden sm:flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" />
            Pazienti
          </Link>
          <Link
            href="/approvvigionamento"
            className="btn-ghost py-1.5 px-3 text-sm hidden sm:flex items-center gap-1.5"
          >
            <ClipboardList className="w-4 h-4" />
            Ordini
          </Link>
          <Link
            href="/impostazioni"
            className="p-2 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors"
            title="Impostazioni"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <Suspense fallback={
            <div className="p-2 text-ink-soft"><Bell className="w-4 h-4 opacity-40" /></div>
          }>
            <AlertBellServer orgId={ctx.organization.id} />
          </Suspense>
          <RoleBadge role={ctx.role} />
          <span className="text-sm text-ink-soft hidden sm:block">
            {ctx.profile.full_name}
          </span>
          <form action={logoutAction}>
            <button type="submit" className="btn-ghost p-2" aria-label="Esci">
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
