'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { selezionaUoAction } from '@/app/(app)/seleziona-uo/actions';

interface UnitaOperativa { id: string; nome: string; attiva: boolean; }

export function UoSwitcher({
  uoAttiva,
  unita,
}: {
  uoAttiva: UnitaOperativa;
  unita: UnitaOperativa[];
}) {
  const [open, setOpen]       = useState(false);
  const [isPending, start]    = useTransition();
  const ref                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function handleSwitch(id: string) {
    if (id === uoAttiva.id) { setOpen(false); return; }
    setOpen(false);
    const fd = new FormData();
    fd.append('uo_id', id);
    fd.append('back', window.location.pathname);
    start(() => selezionaUoAction(fd));
  }

  const attive = unita.filter((u) => u.attiva);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 transition-colors text-sm font-medium text-ink max-w-[180px]"
      >
        {isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-forest shrink-0" />
          : <Building2 className="w-3.5 h-3.5 text-forest shrink-0" />
        }
        <span className="truncate">{uoAttiva.nome}</span>
        <ChevronDown className="w-3.5 h-3.5 text-ink-mute shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-bg-card border border-line rounded-xl shadow-xl w-56 py-1 text-sm overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold text-ink-mute uppercase tracking-wide border-b border-line">
            Cambia UO
          </p>
          {attive.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSwitch(u.id)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-bg-soft transition-colors ${
                u.id === uoAttiva.id ? 'text-forest font-semibold' : 'text-ink'
              }`}
            >
              <span className="truncate">{u.nome}</span>
              {u.id === uoAttiva.id && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
