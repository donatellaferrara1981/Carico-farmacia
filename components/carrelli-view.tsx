'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ShoppingCart, Plus, AlertTriangle, Clock } from 'lucide-react';
import { creaCarrelloAction } from '@/app/(app)/carrelli/actions';

interface ArticoloMinimo {
  id: string;
  data_alert: string | null;
}

interface Carrello {
  id: string;
  nome: string;
  descrizione: string | null;
  unita_operativa_id: string;
  articoli_carrello: ArticoloMinimo[];
}

interface UnitaOperativa {
  id: string;
  nome: string;
  attiva: boolean;
}

interface Props {
  carrelli: Carrello[];
  unita: UnitaOperativa[];
  orgId: string;
  canEdit: boolean;
}

function statoAlert(articoli: ArticoloMinimo[]): 'urgente' | 'warning' | null {
  const oggi = new Date();
  const tra30 = new Date(oggi);
  tra30.setDate(tra30.getDate() + 30);

  for (const a of articoli) {
    if (!a.data_alert) continue;
    const alertDate = new Date(a.data_alert);
    if (alertDate <= oggi) return 'urgente';
  }
  for (const a of articoli) {
    if (!a.data_alert) continue;
    const alertDate = new Date(a.data_alert);
    if (alertDate <= tra30) return 'warning';
  }
  return null;
}

export function CarrelliView({ carrelli, unita, orgId, canEdit }: Props) {
  const [showNuovoForm, setShowNuovoForm] = useState<string | null>(null);
  const [nomeNuovo, setNomeNuovo] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const unitaAttive = unita.filter((u) => u.attiva);

  function handleCrea(uoId: string) {
    if (!nomeNuovo.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await creaCarrelloAction(orgId, uoId, nomeNuovo.trim());
        setShowNuovoForm(null);
        setNomeNuovo('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore');
      }
    });
  }

  return (
    <div className="space-y-8">
      {unitaAttive.map((uo) => {
        const carrelliUO = carrelli.filter((c) => c.unita_operativa_id === uo.id);
        return (
          <section key={uo.id}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-ink-soft" />
                {uo.nome}
              </h2>
              {canEdit && (
                <button
                  onClick={() => { setShowNuovoForm(uo.id); setNomeNuovo(''); }}
                  className="flex items-center gap-1.5 text-xs text-forest hover:text-forest/80 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuovo carrello
                </button>
              )}
            </div>

            {showNuovoForm === uo.id && (
              <div className="mb-3 p-3 rounded-xl border border-line bg-bg-soft">
                <p className="text-xs text-ink-soft mb-2 font-medium">Nome nuovo carrello</p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={nomeNuovo}
                    onChange={(e) => setNomeNuovo(e.target.value)}
                    placeholder="es. Carrello Rosso"
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-line bg-bg focus:outline-none focus:ring-1 focus:ring-forest"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCrea(uo.id); if (e.key === 'Escape') setShowNuovoForm(null); }}
                  />
                  <button
                    onClick={() => handleCrea(uo.id)}
                    disabled={isPending || !nomeNuovo.trim()}
                    className="px-3 py-1.5 text-sm rounded-lg bg-forest text-white font-medium disabled:opacity-50"
                  >
                    Crea
                  </button>
                  <button
                    onClick={() => setShowNuovoForm(null)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink-soft hover:text-ink"
                  >
                    Annulla
                  </button>
                </div>
                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
              </div>
            )}

            {carrelliUO.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-ink-mute">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nessun carrello per questa UO.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {carrelliUO.map((carrello) => {
                  const stato = statoAlert(carrello.articoli_carrello);
                  const count = carrello.articoli_carrello.length;
                  return (
                    <Link
                      key={carrello.id}
                      href={`/carrelli/${carrello.id}`}
                      className="flex items-center gap-3 p-4 rounded-xl border border-line bg-bg-card hover:border-forest/40 hover:bg-forest/5 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        stato === 'urgente' ? 'bg-red-100' : stato === 'warning' ? 'bg-amber/10' : 'bg-forest-tint'
                      }`}>
                        <ShoppingCart className={`w-5 h-5 ${
                          stato === 'urgente' ? 'text-red-600' : stato === 'warning' ? 'text-amber' : 'text-forest'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm truncate">{carrello.nome}</p>
                        <p className="text-xs text-ink-mute">{count} {count === 1 ? 'articolo' : 'articoli'}</p>
                      </div>
                      {stato === 'urgente' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          URGENTE
                        </span>
                      )}
                      {stato === 'warning' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber bg-amber/10 px-2 py-0.5 rounded-full shrink-0">
                          <Clock className="w-3 h-3" />
                          30 gg
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {unitaAttive.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-mute">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nessuna unità operativa configurata.</p>
        </div>
      )}
    </div>
  );
}
