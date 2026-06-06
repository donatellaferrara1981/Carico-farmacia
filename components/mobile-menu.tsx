'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Menu, X, BarChart2, CalendarDays, ClipboardList, Building2, Check, Loader2 } from 'lucide-react';
import { selezionaUoAction } from '@/app/(app)/seleziona-uo/actions';

const NAV_LINKS = [
  { href: '/grafici',            label: 'Grafici',    Icon: BarChart2     },
  { href: '/calendario',         label: 'Calendario', Icon: CalendarDays  },
  { href: '/approvvigionamento', label: 'Ordini',     Icon: ClipboardList },
];

interface UnitaOperativa { id: string; nome: string; attiva: boolean; }

export function MobileMenu({
  uoAttiva,
  unita = [],
}: {
  uoAttiva?: UnitaOperativa | null;
  unita?: UnitaOperativa[];
}) {
  const [open, setOpen]    = useState(false);
  const [isPending, start] = useTransition();

  function handleSwitch(id: string) {
    setOpen(false);
    const fd = new FormData();
    fd.append('uo_id', id);
    fd.append('back', window.location.pathname);
    start(() => selezionaUoAction(fd));
  }

  const attive = unita.filter((u) => u.attiva);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="sm:hidden p-2 rounded-lg hover:bg-bg-soft text-ink-soft"
        aria-label="Menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="sm:hidden fixed top-14 left-0 right-0 z-20 bg-bg/98 backdrop-blur border-b border-line shadow-lg">
          {/* UO switcher mobile */}
          {attive.length > 0 && (
            <div className="border-b border-line">
              <p className="px-5 pt-3 pb-1.5 text-xs font-semibold text-ink-mute uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Unità Operativa
              </p>
              {attive.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSwitch(u.id)}
                  disabled={isPending}
                  className={`w-full flex items-center justify-between px-5 py-3 text-sm transition-colors ${
                    u.id === uoAttiva?.id ? 'text-forest font-semibold bg-forest/5' : 'text-ink hover:bg-bg-soft'
                  }`}
                >
                  <span>{u.nome}</span>
                  {u.id === uoAttiva?.id
                    ? <Check className="w-4 h-4 text-forest" />
                    : isPending ? <Loader2 className="w-4 h-4 animate-spin text-ink-mute" /> : null
                  }
                </button>
              ))}
            </div>
          )}

          {/* Nav links */}
          <nav className="flex flex-col py-2">
            {NAV_LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors text-sm font-medium"
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
