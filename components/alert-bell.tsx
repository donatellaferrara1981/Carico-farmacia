'use client';

import { useState } from 'react';
import { Bell, X, AlertTriangle, Calendar, Package, PackageOpen } from 'lucide-react';

export interface AlertItem {
  id: string;
  tipo: 'scorta' | 'scadenza' | 'consegna_parziale';
  principio_attivo: string;
  nome_commerciale: string | null;
  dosaggio: string | null;
  categoria: string;
  // scorta
  quantita?: number;
  soglia?: number;
  // scadenza
  data_scadenza?: string;
  giorni_alla_scadenza?: number;
  // consegna parziale
  giorni_rimanenti?: number;
  data_esaurimento?: string;
  quantita_mancante?: number;
  ciclo_totale?: number;
}

export function AlertBell({ alerts }: { alerts: AlertItem[] }) {
  const [open, setOpen] = useState(false);

  const scorte    = alerts.filter((a) => a.tipo === 'scorta');
  const scadenze  = alerts.filter((a) => a.tipo === 'scadenza');
  const parziali  = alerts.filter((a) => a.tipo === 'consegna_parziale');
  const count     = alerts.length;

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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-bg-card rounded-2xl shadow-xl border border-line overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <h3 className="font-semibold text-sm text-ink">Alert farmaci</h3>
              <button onClick={() => setOpen(false)} className="text-ink-mute hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              {count === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-ink-mute opacity-30" />
                  <p className="text-sm text-ink-mute">Nessun alert attivo</p>
                </div>
              ) : (
                <>
                  {/* Consegne parziali */}
                  {parziali.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-orange-50 border-b border-orange-200">
                        <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                          <PackageOpen className="w-3.5 h-3.5" /> Richiedere rimanenza ({parziali.length})
                        </p>
                      </div>
                      {parziali.map((a) => (
                        <div key={a.id + '-parz'} className="px-4 py-3 border-b border-line/50 hover:bg-orange-50/40">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink leading-tight">
                                {a.principio_attivo}
                                {a.nome_commerciale && (
                                  <span className="text-ink-mute font-normal"> · {a.nome_commerciale}</span>
                                )}
                              </p>
                              {a.dosaggio && <p className="text-xs text-ink-mute">{a.dosaggio}</p>}
                              <p className="text-xs text-ink-mute capitalize">{a.categoria}</p>
                              {a.data_esaurimento && (
                                <p className="text-xs text-orange-600 mt-0.5">
                                  Scorte fino al {new Date(a.data_esaurimento).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-sm font-bold ${(a.giorni_rimanenti ?? 99) <= 2 ? 'text-abx' : 'text-orange-600'}`}>
                                {a.giorni_rimanenti === 0 ? 'OGGI' : `${a.giorni_rimanenti} gg`}
                              </span>
                              {a.quantita_mancante !== undefined && a.quantita_mancante > 0 && (
                                <p className="text-xs text-orange-600 font-semibold">-{a.quantita_mancante} da richiedere</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Scorte */}
                  {scorte.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-amber/10 border-b border-amber/20">
                        <p className="text-xs font-semibold text-amber flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" /> Scorte in esaurimento ({scorte.length})
                        </p>
                      </div>
                      {scorte.map((a) => (
                        <div key={a.id} className="px-4 py-3 border-b border-line/50 hover:bg-bg-soft/40">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-ink leading-tight">
                                {a.principio_attivo}
                                {a.nome_commerciale && (
                                  <span className="text-ink-mute font-normal"> · {a.nome_commerciale}</span>
                                )}
                              </p>
                              {a.dosaggio && <p className="text-xs text-ink-mute">{a.dosaggio}</p>}
                              <p className="text-xs text-ink-mute capitalize">{a.categoria}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-sm font-bold ${a.quantita === 0 ? 'text-abx' : 'text-amber'}`}>
                                {a.quantita === 0 ? 'ESAURITO' : `${a.quantita} pz`}
                              </span>
                              {a.soglia !== undefined && a.quantita !== 0 && (
                                <p className="text-xs text-ink-mute">soglia: {a.soglia}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Scadenze */}
                  {scadenze.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                        <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Scadenze imminenti ({scadenze.length})
                        </p>
                      </div>
                      {scadenze.map((a) => (
                        <div key={a.id + '-scad'} className="px-4 py-3 border-b border-line/50 hover:bg-bg-soft/40">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-ink leading-tight">
                                {a.principio_attivo}
                                {a.nome_commerciale && (
                                  <span className="text-ink-mute font-normal"> · {a.nome_commerciale}</span>
                                )}
                              </p>
                              {a.dosaggio && <p className="text-xs text-ink-mute">{a.dosaggio}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-sm font-bold ${(a.giorni_alla_scadenza ?? 99) <= 3 ? 'text-abx' : 'text-amber'}`}>
                                {a.giorni_alla_scadenza === 0 ? 'OGGI' : `${a.giorni_alla_scadenza} gg`}
                              </span>
                              <p className="text-xs text-ink-mute">{a.data_scadenza}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
