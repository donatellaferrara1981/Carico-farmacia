import Link from 'next/link';
import { Logo } from './logo';
import { RoleBadge } from './role-badge';
import { logoutAction } from '@/app/(auth)/actions';
import { LogOut, ClipboardList } from 'lucide-react';
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
            href="/approvvigionamento"
            className="btn-ghost py-1.5 px-3 text-sm hidden sm:flex items-center gap-1.5"
          >
            <ClipboardList className="w-4 h-4" />
            Ordini
          </Link>
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
