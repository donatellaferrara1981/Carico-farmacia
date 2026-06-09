'use client';

import { useState, useRef, useCallback, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Bell, X, Calendar, Package, Maximize2, Minimize2, GripHorizontal, Trash2, Clock } from 'lucide-react';
import { archiaviaAvvisoAction, archiviaTuttiAction } from '@/app/(app)/avvisi/actions';

export interface AlertItem {
  id: string;
  tipo: 'scorta' | 'scadenza' | 'esaurimento';
  principio_attivo: string;
  nome_commerciale: string | null;
  dosaggio: string | null;
  categoria: string;
  quantita?: number;
  soglia?: number;
  data_scadenza?: string;
  giorni_alla_scadenza?: number;
  data_esaurimento?: string;
}

function AlertRow({ alert: a, onDismiss }: { alert: AlertItem; onDismiss: () => void }) {
  const [pending, start] = useTransition();

  function dismiss() {
    start(async () => {
      await archiaviaAvvisoAction(a.id, a.tipo);
      onDismiss();
    });
  }

  const badge = () => {
    if (a.tipo === 'scorta')
      return <span className={`text-[10px] font-bold tabular-nums ${a.quantita === 0 ? 'text-abx' : 'text-amber'}`}>{a.quantita === 0 ? 'ESAUR.' : `${a.quantita} pz`}</span>;
    if (a.tipo === 'scadenza')
      return <span className={`text-[10px] font-bold tabular-nums ${(a.giorni_alla_scadenza ?? 99) <= 3 ? 'text-abx' : 'text-amber'}`}>{a.giorni_alla_scadenza === 0 ? 'OGGI' : `${a.giorni_alla_scadenza}gg`}</span>;
    return <span className="text-[10px] font-bold tabular-nums text-abx">{a.giorni_alla_scadenza === 0 ? 'OGGI' : `${a.giorni_alla_scadenza}gg`}</span>;
  };

  return (
    <tr className="border-b border-line/30 hover:bg-bg-soft/40">
      <td className="pl-2.5 pr-1 py-1 max-w-0 w-full">
        <p className="text-[11px] font-medium text-ink truncate leading-tight">
          {a.principio_attivo}
          {a.nome_commerciale && <span className="font-normal text-ink-mute"> · {a.nome_commerciale}</span>}
        </p>
        {a.dosaggio && <p className="text-[9px] text-ink-mute leading-tight">{a.dosaggio}</p>}
      </td>
      <td className="px-1 py-1 text-right shrink-0">{badge()}</td>
      <td className="pl-1 pr-1.5 py-1 shrink-0">
        <button onClick={dismiss} disabled={pending} title="Archivia"
          className="p-0.5 rounded text-ink-mute hover:text-abx hover:bg-abx/10 transition-colors">
          {pending
            ? <span className="w-2.5 h-2.5 block border border-current border-t-transparent rounded-full animate-spin" />
            : <X className="w-2.5 h-2.5" />}
        </button>
      </td>
    </tr>
  );
}

const SECTION_META = {
  esaurimento: { label: 'Esaurimento imminente', icon: Clock,   color: 'text-abx',        bg: 'bg-abx/10'     },
  scorta:      { label: 'Scorte basse',          icon: Package, color: 'text-amber',       bg: 'bg-amber/10'   },
  scadenza:    { label: 'Scadenze',              icon: Calendar,color: 'text-purple-600',  bg: 'bg-purple-50'  },
} as const;

export function AlertBell({ alerts: initialAlerts }: { alerts: AlertItem[] }) {
  const [open, setOpen]             = useState(false);
  const [expanded, setExpanded]     = useState(false);
  const [pos, setPos]               = useState<{ x: number; y: number } | null>(null);
  const [alerts, setAlerts]         = useState(initialAlerts);
  const [clearPending, startClear]  = useTransition();
  const dragging                    = useRef(false);
  const dragStart                   = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const panelRef                    = useRef<HTMLDivElement>(null);

  useEffect(() => { setAlerts(initialAlerts); }, [initialAlerts]);
  useEffect(() => { if (!open) { setPos(null); setExpanded(false); } }, [open]);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({ x: dragStart.current.px + (e.clientX - dragStart.current.mx), y: dragStart.current.py + (e.clientY - dragStart.current.my) });
  }, []);

  const onDragEnd = useCallback(() => { dragging.current = false; }, []);

  function dismissOne(id: string, tipo: string) {
    setAlerts(prev => prev.filter(a => !(a.id === id && a.tipo === tipo)));
  }

  function azzeraTutto() {
    startClear(async () => {
      await archiviaTuttiAction(alerts.map(a => ({ id: a.id, tipo: a.tipo })));
      setAlerts([]);
    });
  }

  const groups = (['esaurimento', 'scorta', 'scadenza'] as const).map(tipo => ({
    tipo,
    items: alerts.filter(a => a.tipo === tipo),
    meta: SECTION_META[tipo],
  })).filter(g => g.items.length > 0);

  const count = alerts.length;

  const panelStyle = pos
    ? { position: 'fixed' as const, left: pos.x, top: pos.y, right: 'auto', zIndex: 50 }
    : { position: 'absolute' as const, right: 0, top: 40, zIndex: 50 };

  const width = expanded ? 'w-[92vw] sm:w-[420px]' : 'w-72 sm:w-72';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-ink transition-colors"
        title="Alert farmaci"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-abx text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {!pos && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

          <div ref={panelRef} style={panelStyle}
            className={`${width} bg-bg-card rounded-xl shadow-2xl border border-line overflow-hidden transition-[width] duration-150`}>

            {/* Header — grip separato dai pulsanti */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-line bg-bg-soft shrink-0">
              <div
                className="flex items-center gap-1.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
              >
                <GripHorizontal className="w-3.5 h-3.5 text-ink-mute shrink-0" />
                <span className="text-xs font-semibold text-ink truncate">
                  Notifiche {count > 0 && <span className="text-abx">({count})</span>}
                </span>
              </div>

              {count > 0 && (
                <button onClick={azzeraTutto} disabled={clearPending} title="Azzera tutto"
                  className="p-1 rounded text-ink-mute hover:text-abx hover:bg-abx/10 transition-colors shrink-0">
                  {clearPending
                    ? <span className="w-3 h-3 block border border-current border-t-transparent rounded-full animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                </button>
              )}
              <button onClick={() => setExpanded(v => !v)} title={expanded ? 'Riduci' : 'Espandi'}
                className="p-1 rounded text-ink-mute hover:text-ink hover:bg-bg transition-colors shrink-0">
                {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
              <button onClick={() => setOpen(false)}
                className="p-1 rounded text-ink-mute hover:text-ink hover:bg-bg transition-colors shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Contenuto */}
            <div className={`overflow-y-auto ${expanded ? 'max-h-[70vh]' : 'max-h-64'}`}>
              {count === 0 ? (
                <div className="px-4 py-5 text-center">
                  <Bell className="w-6 h-6 mx-auto mb-2 text-ink-mute opacity-30" />
                  <p className="text-xs text-ink-mute">Nessuna notifica attiva</p>
                </div>
              ) : (
                groups.map(({ tipo, items, meta }) => {
                  const Icon = meta.icon;
                  return (
                    <section key={tipo}>
                      <div className={`px-2.5 py-1 ${meta.bg} border-b border-line/40 sticky top-0`}>
                        <p className={`text-[10px] font-semibold ${meta.color} flex items-center gap-1`}>
                          <Icon className="w-2.5 h-2.5" /> {meta.label} ({items.length})
                        </p>
                      </div>
                      <table className="w-full">
                        <tbody>
                          {items.map(a => (
                            <AlertRow key={`${a.id}-${tipo}`} alert={a} onDismiss={() => dismissOne(a.id, a.tipo)} />
                          ))}
                        </tbody>
                      </table>
                    </section>
                  );
                })
              )}
            </div>

            <div className="px-2.5 py-1.5 border-t border-line bg-bg-soft flex items-center justify-between text-[9px] text-ink-mute">
              <span>✕ per archiviare · 🗑 azzera tutto</span>
              <Link href="/avvisi" onClick={() => setOpen(false)} className="underline underline-offset-2 hover:text-ink">
                storico
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
