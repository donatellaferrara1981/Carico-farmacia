'use client';

import { useState, useRef, useCallback, useEffect, useTransition } from 'react';
import { Bell, X, AlertTriangle, Calendar, Package, Maximize2, Minimize2, GripHorizontal, Trash2, Clock } from 'lucide-react';
import { archiaviaAvvisoAction, azzeraAvvisiAction } from '@/app/(app)/avvisi/actions';

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

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line/40 hover:bg-bg-soft/40 group">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink truncate">
          {a.principio_attivo}
          {a.nome_commerciale && <span className="font-normal text-ink-mute"> · {a.nome_commerciale}</span>}
        </p>
        <p className="text-[10px] text-ink-mute">{a.dosaggio ?? ''}{a.dosaggio && a.categoria ? ' · ' : ''}{a.categoria}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {a.tipo === 'scorta' && (
          <span className={`text-xs font-bold ${a.quantita === 0 ? 'text-abx' : 'text-amber'}`}>
            {a.quantita === 0 ? 'ESAURITO' : `${a.quantita} pz`}
          </span>
        )}
        {a.tipo === 'scadenza' && (
          <div className="text-right">
            <span className={`text-xs font-bold block ${(a.giorni_alla_scadenza ?? 99) <= 3 ? 'text-abx' : 'text-amber'}`}>
              {a.giorni_alla_scadenza === 0 ? 'OGGI' : `${a.giorni_alla_scadenza} gg`}
            </span>
            <span className="text-[10px] text-ink-mute">{a.data_scadenza}</span>
          </div>
        )}
        {a.tipo === 'esaurimento' && (
          <div className="text-right">
            <span className="text-xs font-bold block text-abx">
              {a.giorni_alla_scadenza === 0 ? 'OGGI' : `${a.giorni_alla_scadenza} gg`}
            </span>
            <span className="text-[10px] text-ink-mute">esaur. {a.data_esaurimento}</span>
          </div>
        )}

        <button
          onClick={dismiss}
          disabled={pending}
          title="Archivia notifica"
          className="p-1 rounded text-ink-mute hover:text-abx hover:bg-abx/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          {pending ? <span className="w-3 h-3 block border-2 border-current border-t-transparent rounded-full animate-spin" /> : <X className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

export function AlertBell({ alerts: initialAlerts }: { alerts: AlertItem[] }) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos]           = useState<{ x: number; y: number } | null>(null);
  const [alerts, setAlerts]     = useState(initialAlerts);
  const [clearPending, startClear] = useTransition();
  const dragging                = useRef(false);
  const dragStart               = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const panelRef                = useRef<HTMLDivElement>(null);

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
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  }, []);

  const onDragEnd = useCallback(() => { dragging.current = false; }, []);

  function dismissOne(id: string, tipo: string) {
    setAlerts(prev => prev.filter(a => !(a.id === id && a.tipo === tipo)));
  }

  function azzeraTutto() {
    startClear(async () => {
      await azzeraAvvisiAction();
      setAlerts([]);
    });
  }

  const scorte    = alerts.filter(a => a.tipo === 'scorta');
  const scadenze  = alerts.filter(a => a.tipo === 'scadenza');
  const esaur     = alerts.filter(a => a.tipo === 'esaurimento');
  const count     = alerts.length;

  const panelStyle = pos
    ? { position: 'fixed' as const, left: pos.x, top: pos.y, right: 'auto', zIndex: 50 }
    : { position: 'absolute' as const, right: 0, top: 40, zIndex: 50 };

  const width = expanded ? 'w-[92vw] sm:w-[480px]' : 'w-[92vw] sm:w-80';

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

          <div
            ref={panelRef}
            style={panelStyle}
            className={`${width} bg-bg-card rounded-2xl shadow-2xl border border-line overflow-hidden transition-[width] duration-150`}
          >
            {/* Barra titolo draggable */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 border-b border-line bg-bg-soft cursor-grab active:cursor-grabbing select-none"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
            >
              <GripHorizontal className="w-4 h-4 text-ink-mute shrink-0" />
              <h3 className="font-semibold text-sm text-ink flex-1">
                Notifiche {count > 0 && <span className="text-abx">({count})</span>}
              </h3>
              {count > 0 && (
                <button
                  onClick={azzeraTutto}
                  disabled={clearPending}
                  title="Azzera tutte le notifiche"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-ink-mute hover:text-abx hover:bg-abx/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Azzera tutto
                </button>
              )}
              <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors" title={expanded ? 'Riduci' : 'Espandi'}>
                {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Contenuto */}
            <div className={`overflow-y-auto ${expanded ? 'max-h-[70vh]' : 'max-h-72'}`}>
              {count === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Bell className="w-7 h-7 mx-auto mb-2 text-ink-mute opacity-30" />
                  <p className="text-sm text-ink-mute">Nessuna notifica attiva</p>
                </div>
              ) : (
                <>
                  {/* Esaurimento scorta consegnata */}
                  {esaur.length > 0 && (
                    <section>
                      <div className="px-3 py-1.5 bg-abx/10 border-b border-abx/20 sticky top-0">
                        <p className="text-xs font-semibold text-abx flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Esaurimento scorta imminente ({esaur.length})
                        </p>
                      </div>
                      {esaur.map(a => (
                        <AlertRow key={`${a.id}-esaur`} alert={a} onDismiss={() => dismissOne(a.id, a.tipo)} />
                      ))}
                    </section>
                  )}

                  {/* Scorte basse */}
                  {scorte.length > 0 && (
                    <section>
                      <div className="px-3 py-1.5 bg-amber/10 border-b border-amber/20 sticky top-0">
                        <p className="text-xs font-semibold text-amber flex items-center gap-1.5">
                          <Package className="w-3 h-3" /> Scorte esaurite / in esaurimento ({scorte.length})
                        </p>
                      </div>
                      {scorte.map(a => (
                        <AlertRow key={`${a.id}-scorta`} alert={a} onDismiss={() => dismissOne(a.id, a.tipo)} />
                      ))}
                    </section>
                  )}

                  {/* Scadenze */}
                  {scadenze.length > 0 && (
                    <section>
                      <div className="px-3 py-1.5 bg-purple-50 border-b border-purple-100 sticky top-0">
                        <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> Scadenze imminenti ({scadenze.length})
                        </p>
                      </div>
                      {scadenze.map(a => (
                        <AlertRow key={`${a.id}-scad`} alert={a} onDismiss={() => dismissOne(a.id, a.tipo)} />
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>

            {count > 0 && (
              <div className="px-3 py-2 border-t border-line bg-bg-soft text-[10px] text-ink-mute">
                Passa su una notifica per archiviarla · "Azzera tutto" le rimuove tutte
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
