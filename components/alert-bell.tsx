'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Bell, X, AlertTriangle, Calendar, Package, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';

export interface AlertItem {
  id: string;
  tipo: 'scorta' | 'scadenza';
  principio_attivo: string;
  nome_commerciale: string | null;
  dosaggio: string | null;
  categoria: string;
  quantita?: number;
  soglia?: number;
  data_scadenza?: string;
  giorni_alla_scadenza?: number;
}

export function AlertBell({ alerts }: { alerts: AlertItem[] }) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos]           = useState<{ x: number; y: number } | null>(null);
  const dragging                = useRef(false);
  const dragStart               = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const panelRef                = useRef<HTMLDivElement>(null);

  const scorte   = alerts.filter((a) => a.tipo === 'scorta');
  const scadenze = alerts.filter((a) => a.tipo === 'scadenza');
  const count    = alerts.length;

  // Resetta posizione quando si chiude
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
          {/* overlay solo se non è stato spostato */}
          {!pos && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

          <div
            ref={panelRef}
            style={panelStyle}
            className={`${width} bg-bg-card rounded-2xl shadow-2xl border border-line overflow-hidden transition-[width] duration-150`}
          >
            {/* Barra titolo — draggable */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 border-b border-line bg-bg-soft cursor-grab active:cursor-grabbing select-none"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
            >
              <GripHorizontal className="w-4 h-4 text-ink-mute shrink-0" />
              <h3 className="font-semibold text-sm text-ink flex-1">
                Alert farmaci {count > 0 && <span className="text-abx">({count})</span>}
              </h3>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors"
                title={expanded ? 'Riduci' : 'Espandi'}
              >
                {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Contenuto */}
            <div className={`overflow-y-auto ${expanded ? 'max-h-[70vh]' : 'max-h-72'}`}>
              {count === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Bell className="w-7 h-7 mx-auto mb-2 text-ink-mute opacity-30" />
                  <p className="text-sm text-ink-mute">Nessun alert attivo</p>
                </div>
              ) : (
                <>
                  {scorte.length > 0 && (
                    <section>
                      <div className="px-3 py-1.5 bg-amber/10 border-b border-amber/20 sticky top-0">
                        <p className="text-xs font-semibold text-amber flex items-center gap-1.5">
                          <Package className="w-3 h-3" /> Scorte esaurite / in esaurimento ({scorte.length})
                        </p>
                      </div>
                      {scorte.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line/40 hover:bg-bg-soft/40">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              {a.principio_attivo}
                              {a.nome_commerciale && <span className="font-normal text-ink-mute"> · {a.nome_commerciale}</span>}
                            </p>
                            <p className="text-[10px] text-ink-mute">{a.dosaggio ?? ''}{a.dosaggio && a.categoria ? ' · ' : ''}{a.categoria}</p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${a.quantita === 0 ? 'text-abx' : 'text-amber'}`}>
                            {a.quantita === 0 ? 'ESAURITO' : `${a.quantita} pz`}
                          </span>
                        </div>
                      ))}
                    </section>
                  )}

                  {scadenze.length > 0 && (
                    <section>
                      <div className="px-3 py-1.5 bg-purple-50 border-b border-purple-100 sticky top-0">
                        <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> Scadenze imminenti ({scadenze.length})
                        </p>
                      </div>
                      {scadenze.map((a) => (
                        <div key={a.id + '-s'} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line/40 hover:bg-bg-soft/40">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              {a.principio_attivo}
                              {a.nome_commerciale && <span className="font-normal text-ink-mute"> · {a.nome_commerciale}</span>}
                            </p>
                            {a.dosaggio && <p className="text-[10px] text-ink-mute">{a.dosaggio}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-bold block ${(a.giorni_alla_scadenza ?? 99) <= 3 ? 'text-abx' : 'text-amber'}`}>
                              {a.giorni_alla_scadenza === 0 ? 'OGGI' : `${a.giorni_alla_scadenza} gg`}
                            </span>
                            <span className="text-[10px] text-ink-mute">{a.data_scadenza}</span>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
