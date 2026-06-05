'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, BarChart2, CalendarDays, ClipboardList } from 'lucide-react';

const NAV_LINKS = [
  { href: '/grafici', label: 'Grafici', Icon: BarChart2 },
  { href: '/calendario', label: 'Calendario', Icon: CalendarDays },
  { href: '/approvvigionamento', label: 'Ordini', Icon: ClipboardList },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

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
