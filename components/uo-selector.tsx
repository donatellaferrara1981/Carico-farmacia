'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Loader2, Check } from 'lucide-react';
import { selezionaUoAction } from '@/app/(app)/seleziona-uo/actions';

interface UnitaOperativa {
  id: string;
  nome: string;
  attiva: boolean;
}

export function UoSelector({
  unita,
  uoAttivaId,
  backUrl = '/app',
  compact = false,
}: {
  unita: UnitaOperativa[];
  uoAttivaId: string | null;
  backUrl?: string;
  compact?: boolean;
}) {
  const [isPending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const attive = unita.filter((u) => u.attiva);
  const uoAttiva = attive.find((u) => u.id === uoAttivaId) ?? null;
  const altre = attive.filter((u) => u.id !== uoAttivaId);

  function handleSelect(id: string) {
    setOpen(false);
    const fd = new FormData();
    fd.append('uo_id', id);
    fd.append('back', backUrl);
    start(() => selezionaUoAction(fd));
  }

  // Chiudi cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (compact) {
    return (
      <div className="py-1">
        {attive.map((u) => (
          <button
            key={u.id}
            onClick={() => handleSelect(u.id)}
            disabled={isPending}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
              u.id === uoAttivaId
                ? 'bg-forest/10 text-forest font-semibold'
                : 'text-ink hover:bg-bg-soft'
            }`}
          >
            <span>{u.nome}</span>
            {u.id === uoAttivaId && <span className="text-xs text-forest">attiva</span>}
            {isPending && u.id !== uoAttivaId && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-mute" />}
          </button>
        ))}
        {attive.length === 0 && (
          <p className="px-4 py-3 text-sm text-ink-mute">Nessuna UO configurata.</p>
        )}
      </div>
    );
  }

  // Nessuna UO selezionata: mostra tutte le card
  if (!uoAttiva) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {attive.map((u) => (
          <button
            key={u.id}
            onClick={() => handleSelect(u.id)}
            disabled={isPending}
            className="flex items-center justify-between gap-3 p-4 rounded-xl border border-line hover:border-forest/40 hover:shadow-sm bg-bg-card text-left transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-forest-tint text-forest flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <p className="font-semibold text-ink text-sm">{u.nome}</p>
            </div>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin text-ink-mute shrink-0" /> : null}
          </button>
        ))}
      </div>
    );
  }

  // UO già selezionata: mostra solo quella + tendina "Cambia"
  return (
    <div ref={ref} className="relative inline-block">
      <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-forest bg-forest/5">
        <div className="w-9 h-9 rounded-lg bg-forest text-white flex items-center justify-center shrink-0">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm">{uoAttiva.nome}</p>
          <p className="text-xs text-forest">UO attiva</p>
        </div>
        {altre.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink border border-line rounded-lg px-2 py-1 bg-bg-card transition-colors"
          >
            Cambia
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && altre.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-bg-card border border-line rounded-xl shadow-lg min-w-[220px] overflow-hidden">
          {altre.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSelect(u.id)}
              disabled={isPending}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-forest/5 transition-colors"
            >
              <Building2 className="w-4 h-4 text-ink-mute shrink-0" />
              <span className="font-medium text-ink">{u.nome}</span>
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-mute ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
