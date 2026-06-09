'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Bell, Package, Calendar, Clock, Trash2 } from 'lucide-react';
import { ripristinaAvvisoAction, azzeraAvvisiAction } from '@/app/(app)/avvisi/actions';

type TipoAvviso = 'scorta' | 'scadenza' | 'esaurimento';

interface AvvisoArchiviato {
  prodotto_id: string;
  tipo: string;
  archiviato_il: string;
  prodotti: {
    principio_attivo: string;
    nome_commerciale: string | null;
    dosaggio: string | null;
    categoria: string;
  } | null;
}

const TIPO_LABEL: Record<TipoAvviso, { label: string; icon: React.ReactNode; color: string }> = {
  scorta:      { label: 'Scorta bassa',            icon: <Package className="w-3 h-3" />,  color: 'text-amber bg-amber/10' },
  scadenza:    { label: 'Scadenza imminente',       icon: <Calendar className="w-3 h-3" />, color: 'text-purple-600 bg-purple-50' },
  esaurimento: { label: 'Esaurimento scorta',       icon: <Clock className="w-3 h-3" />,    color: 'text-abx bg-abx/10' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AvvisiArchiviatiView({ items: initialItems }: { items: AvvisoArchiviato[] }) {
  const [items, setItems] = useState(initialItems);
  const [restorePending, startRestore] = useTransition();
  const [clearPending, startClear] = useTransition();

  function ripristina(prodottoId: string, tipo: string) {
    startRestore(async () => {
      await ripristinaAvvisoAction(prodottoId, tipo);
      setItems(prev => prev.filter(i => !(i.prodotto_id === prodottoId && i.tipo === tipo)));
    });
  }

  function azzeraTutto() {
    startClear(async () => {
      await azzeraAvvisiAction();
      setItems([]);
    });
  }

  if (items.length === 0) {
    return (
      <div className="card text-center py-12">
        <Bell className="w-10 h-10 mx-auto mb-3 text-ink-mute opacity-30" />
        <p className="text-ink-soft">Nessun avviso archiviato</p>
        <p className="text-xs text-ink-mute mt-1">Gli avvisi che archivi dalla campanella appariranno qui</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">{items.length} avvisi archiviati</p>
        <button
          onClick={azzeraTutto}
          disabled={clearPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-mute hover:text-abx hover:bg-abx/10 border border-line transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Azzera tutto
        </button>
      </div>

      <div className="card divide-y divide-line/60 overflow-hidden p-0">
        {items.map((item) => {
          const p = item.prodotti;
          const tipo = item.tipo as TipoAvviso;
          const meta = TIPO_LABEL[tipo] ?? TIPO_LABEL.scorta;
          return (
            <div key={`${item.prodotto_id}-${item.tipo}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-soft/40">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">
                  {p?.principio_attivo ?? '—'}
                  {p?.nome_commerciale && <span className="font-normal text-ink-mute"> · {p.nome_commerciale}</span>}
                </p>
                <p className="text-xs text-ink-mute">
                  {p?.dosaggio ?? ''}{p?.dosaggio && p?.categoria ? ' · ' : ''}{p?.categoria ?? ''}
                </p>
                <p className="text-[10px] text-ink-mute mt-0.5">Archiviato il {fmtDate(item.archiviato_il)}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
                  {meta.icon} {meta.label}
                </span>
                <button
                  onClick={() => ripristina(item.prodotto_id, item.tipo)}
                  disabled={restorePending}
                  title="Ripristina notifica"
                  className="p-1.5 rounded-lg text-ink-mute hover:text-green-600 hover:bg-green-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
