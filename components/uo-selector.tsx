'use client';

import { useTransition } from 'react';
import { Building2, ChevronRight, Loader2 } from 'lucide-react';
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

  const attive = unita.filter((u) => u.attiva);

  function handleSelect(id: string) {
    const fd = new FormData();
    fd.append('uo_id', id);
    fd.append('back', backUrl);
    start(() => selezionaUoAction(fd));
  }

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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {attive.map((u) => (
        <button
          key={u.id}
          onClick={() => handleSelect(u.id)}
          disabled={isPending}
          className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition-all ${
            u.id === uoAttivaId
              ? 'border-forest bg-forest/5 ring-2 ring-forest/20'
              : 'border-line hover:border-forest/40 hover:shadow-sm bg-bg-card'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              u.id === uoAttivaId ? 'bg-forest text-white' : 'bg-forest-tint text-forest'
            }`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-ink text-sm">{u.nome}</p>
              {u.id === uoAttivaId && <p className="text-xs text-forest">UO attiva</p>}
            </div>
          </div>
          {isPending
            ? <Loader2 className="w-4 h-4 animate-spin text-ink-mute shrink-0" />
            : <ChevronRight className="w-4 h-4 text-ink-mute shrink-0" />
          }
        </button>
      ))}
    </div>
  );
}
