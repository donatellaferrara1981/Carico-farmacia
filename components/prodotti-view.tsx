'use client';

import { useState, useTransition } from 'react';
import { Plus, FileText, Pencil, Trash2, Minus, Plus as PlusIcon, Loader2, Tag, RotateCcw, CalendarPlus, ChevronDown, MoreVertical, ShieldAlert } from 'lucide-react';
import { formaLabel, type ProdottoConDocumenti } from '@/lib/prodotti';
import { classificaFarmaco, CLASSE_LABEL } from '@/lib/antibiotici';
import { ProdottoForm } from '@/components/prodotto-form';
import { SalvaPianoModal } from '@/components/salva-piano-modal';
import { DocumentiList } from '@/components/documenti-list';
import { UploadButton } from '@/components/upload-button';
import { deleteProdottoAction, aggiornaQuantitaAction, toggleNominativaAction, svuotaProdottiAction } from '@/app/(app)/[categoria]/prodotti-actions';
import { svuotaDocumentiAction } from '@/app/(app)/[categoria]/actions';
import type { CategoriaArticolo } from '@/lib/types';

interface DocLibero {
  id: string;
  nome_file: string;
  storage_path: string;
  dimensione: number | null;
  created_at: string;
}

interface Props {
  prodotti: ProdottoConDocumenti[];
  docsLiberi: DocLibero[];
  orgId: string;
  categoria: CategoriaArticolo;
  canEdit: boolean;
}

function CardProdotto({ prodotto, categoria, canEdit, giorni }: {
  prodotto: ProdottoConDocumenti;
  categoria: CategoriaArticolo;
  canEdit: boolean;
  giorni: number;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPendingDel, startDel] = useTransition();
  const [isPendingQ, startQ] = useTransition();
  const [isPendingN, startN] = useTransition();

  const fabbisogno = Math.ceil((prodotto.consumo_giornaliero ?? 1) * giorni);
  const daOrdinare = Math.max(0, fabbisogno - prodotto.quantita);
  const abx = classificaFarmaco(prodotto.principio_attivo);

  const qtyColor =
    prodotto.quantita === 0 ? 'text-abx' :
    prodotto.quantita <= 3 ? 'text-amber' :
    'text-forest';

  return (
    <>
      {editing && (
        <ProdottoForm orgId={prodotto.org_id} categoria={categoria} prodotto={prodotto} onClose={() => setEditing(false)} />
      )}
      <div className={`rounded-xl border bg-bg-card p-3.5 ${prodotto.nominativa ? 'border-amber/40' : abx.isAntibiotico ? 'border-red-200' : 'border-line'}`}>
        {/* Riga 1: nome + azioni */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {abx.isAntibiotico && <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              <p className={`text-sm font-semibold leading-snug ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>
                {prodotto.principio_attivo}
                {prodotto.nome_commerciale && (
                  <span className="text-ink-mute font-normal"> · {prodotto.nome_commerciale}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-forest-tint text-forest font-medium">
                {formaLabel(prodotto.forma_farmaceutica)}
              </span>
              {prodotto.dosaggio && <span className="text-xs text-ink-mute">{prodotto.dosaggio}</span>}
              {prodotto.nominativa && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber/20 text-amber font-medium border border-amber/40">
                  nominativa
                </span>
              )}
              {abx.isAntibiotico && abx.classe && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">
                  {CLASSE_LABEL[abx.classe]}
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="relative shrink-0">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute">
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-bg-card rounded-xl shadow-xl border border-line w-40 py-1 overflow-hidden">
                    <button
                      onClick={() => { setMenuOpen(false); startN(async () => { await toggleNominativaAction(prodotto.id, !prodotto.nominativa, categoria); }); }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft flex items-center gap-2"
                    >
                      <Tag className="w-3.5 h-3.5 text-amber" />
                      {prodotto.nominativa ? 'Rimuovi nominativa' : 'Segna nominativa'}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setEditing(true); }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5 text-ink-mute" /> Modifica
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); if (!confirm(`Eliminare "${prodotto.principio_attivo}"?`)) return; startDel(async () => { await deleteProdottoAction(prodotto.id, categoria); }); }}
                      disabled={isPendingDel}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft flex items-center gap-2 text-abx"
                    >
                      {isPendingDel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Elimina
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Riga 2: metriche */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center bg-bg-soft rounded-lg py-2">
            <p className="text-[10px] text-ink-mute uppercase tracking-wide mb-0.5">/die</p>
            <p className="text-base font-bold text-ink tabular-nums">{prodotto.consumo_giornaliero ?? 1}</p>
          </div>
          <div className="text-center bg-forest/10 rounded-lg py-2">
            <p className="text-[10px] text-forest uppercase tracking-wide mb-0.5">{giorni} gg</p>
            <p className="text-base font-bold text-forest tabular-nums">{fabbisogno}</p>
          </div>
          <div className="text-center bg-bg-soft rounded-lg py-2">
            <p className="text-[10px] text-ink-mute uppercase tracking-wide mb-0.5">Scorte</p>
            <div className="flex items-center justify-center gap-1">
              {canEdit && (
                <button
                  onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, -1, categoria); })}
                  disabled={isPendingQ || prodotto.quantita === 0}
                  className="w-5 h-5 rounded border border-line flex items-center justify-center text-ink-mute disabled:opacity-30 active:bg-bg-soft"
                >
                  <Minus className="w-3 h-3" />
                </button>
              )}
              <span className={`text-base font-bold tabular-nums ${qtyColor}`}>
                {isPendingQ ? <Loader2 className="w-4 h-4 animate-spin inline" /> : prodotto.quantita}
              </span>
              {canEdit && (
                <button
                  onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, 1, categoria); })}
                  disabled={isPendingQ}
                  className="w-5 h-5 rounded border border-line flex items-center justify-center text-ink-mute active:bg-bg-soft"
                >
                  <PlusIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {daOrdinare > 0 && (
          <p className="text-xs text-abx font-medium mt-2 text-center">
            Da ordinare: {daOrdinare} pz
          </p>
        )}
      </div>
    </>
  );
}

const PRESET_GIORNI = [
  { label: '7 gg', value: 7 },
  { label: '14 gg', value: 14 },
  { label: '30 gg', value: 30 },
];

export function ProdottiView({ prodotti, docsLiberi, orgId, categoria, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showPiano, setShowPiano] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [giorni, setGiorni] = useState(7);
  const [customGiorni, setCustomGiorni] = useState('');
  const [modoCustom, setModoCustom] = useState(false);
  const [isPendingReset, startReset] = useTransition();

  const giorniEffettivi = modoCustom ? (parseInt(customGiorni) || 1) : giorni;

  const ordinati = [...prodotti].sort((a, b) =>
    a.principio_attivo.localeCompare(b.principio_attivo) ||
    a.forma_farmaceutica.localeCompare(b.forma_farmaceutica)
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      {canEdit && (
        <div className="flex items-center justify-between gap-2">
          {/* Menu svuota */}
          <div className="relative">
            <button
              onClick={() => setShowResetMenu(!showResetMenu)}
              className="btn-ghost text-xs flex items-center gap-1 text-ink-mute"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Svuota</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showResetMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowResetMenu(false)} />
                <div className="absolute left-0 top-9 z-20 bg-bg-card rounded-xl shadow-xl border border-line w-44 py-1 overflow-hidden">
                  <button
                    onClick={() => { setShowResetMenu(false); if (!confirm('Eliminare tutti i prodotti?')) return; startReset(async () => { await svuotaProdottiAction(orgId, categoria); }); }}
                    disabled={isPendingReset || prodotti.length === 0}
                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft text-abx disabled:opacity-40 flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Svuota prodotti
                  </button>
                  <button
                    onClick={() => { setShowResetMenu(false); if (!confirm('Eliminare tutti i documenti?')) return; startReset(async () => { await svuotaDocumentiAction(orgId, categoria); }); }}
                    disabled={isPendingReset || docsLiberi.length === 0}
                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft text-abx disabled:opacity-40 flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Svuota documenti
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            <span>Nuovo</span>
          </button>
        </div>
      )}

      {showForm && (
        <ProdottoForm orgId={orgId} categoria={categoria} onClose={() => setShowForm(false)} />
      )}

      {ordinati.length === 0 && docsLiberi.length === 0 ? (
        <div className="text-center py-16 text-ink-mute">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessun prodotto ancora.</p>
          {canEdit && <p className="text-xs mt-1">Carica un PDF e clicca "Estrai" oppure aggiungi manualmente.</p>}
        </div>
      ) : (
        <>
          {/* Selettore periodo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-ink-soft shrink-0">Fabbisogno:</span>
            <div className="flex gap-1.5 flex-wrap flex-1">
              {PRESET_GIORNI.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setGiorni(p.value); setModoCustom(false); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    !modoCustom && giorni === p.value
                      ? 'bg-forest text-white border-forest'
                      : 'border-line text-ink-soft hover:border-forest/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setModoCustom(!modoCustom)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  modoCustom ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft'
                }`}
              >
                …gg
              </button>
              {modoCustom && (
                <input
                  type="number" min={1} max={365} value={customGiorni}
                  onChange={(e) => setCustomGiorni(e.target.value)}
                  placeholder="giorni"
                  className="w-20 px-2 py-1.5 text-xs border border-line rounded-full text-center focus:outline-none focus:border-forest"
                  autoFocus
                />
              )}
            </div>
            {ordinati.length > 0 && (
              <button
                onClick={() => setShowPiano(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-forest/40 text-forest hover:bg-forest hover:text-white transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salva nel calendario</span>
                <span className="sm:hidden">Salva</span>
              </button>
            )}
          </div>

          {showPiano && (
            <SalvaPianoModal
              orgId={orgId}
              categoria={categoria}
              giorni={giorniEffettivi}
              righe={ordinati.map((p) => ({
                principio_attivo: p.principio_attivo,
                nome_commerciale: p.nome_commerciale,
                forma_farmaceutica: p.forma_farmaceutica,
                dosaggio: p.dosaggio,
                consumo_giornaliero: p.consumo_giornaliero ?? 1,
                fabbisogno: Math.ceil((p.consumo_giornaliero ?? 1) * giorniEffettivi),
                quantita_disponibile: p.quantita,
                da_ordinare: Math.max(0, Math.ceil((p.consumo_giornaliero ?? 1) * giorniEffettivi) - p.quantita),
              }))}
              onClose={() => setShowPiano(false)}
            />
          )}

          {/* Card list (mobile) + Table (desktop) */}
          <div className="sm:hidden space-y-3">
            {ordinati.map((p) => (
              <CardProdotto key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} giorni={giorniEffettivi} />
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-soft border-b border-line">
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide">Farmaco</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">/die</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-forest uppercase tracking-wide text-center">{giorniEffettivi} gg</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">Scorte</th>
                  {canEdit && <th className="px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {ordinati.map((p) => {
                  const fabbisogno = Math.ceil((p.consumo_giornaliero ?? 1) * giorniEffettivi);
                  const qtyColor = p.quantita === 0 ? 'text-abx font-bold' : p.quantita <= 3 ? 'text-amber font-bold' : 'text-forest font-bold';
                  const [editing, setEditing] = useState(false);
                  const [isPendingDel, startDel] = useTransition();
                  const [isPendingQ, startQ] = useTransition();
                  const [isPendingN, startN] = useTransition();
                  const rowAbx = classificaFarmaco(p.principio_attivo);
                  return (
                    <tr key={p.id} className={`border-b border-line/50 hover:bg-bg-soft/40 transition-colors ${rowAbx.isAntibiotico ? 'bg-red-50/40' : ''}`}>
                      {editing && <ProdottoForm orgId={p.org_id} categoria={categoria} prodotto={p} onClose={() => setEditing(false)} />}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rowAbx.isAntibiotico && <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <span className={`text-sm font-medium ${rowAbx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>{p.principio_attivo}</span>
                            {p.nome_commerciale && <span className="text-xs text-ink-mute italic">· {p.nome_commerciale}</span>}
                            {p.nominativa && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber/20 text-amber font-medium border border-amber/40">nominativa</span>}
                            {rowAbx.isAntibiotico && rowAbx.classe && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">{CLASSE_LABEL[rowAbx.classe]}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-forest-tint text-forest font-medium">{formaLabel(p.forma_farmaceutica)}</span>
                            {p.dosaggio && <span className="text-xs text-ink-mute">{p.dosaggio}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        <span className="text-sm font-semibold text-ink">{p.consumo_giornaliero ?? 1}</span>
                        <span className="text-xs text-ink-mute">/die</span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        <span className="text-sm font-semibold text-forest">{fabbisogno}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-center">
                          {canEdit && <button onClick={() => startQ(async () => { await aggiornaQuantitaAction(p.id, -1, categoria); })} disabled={isPendingQ || p.quantita === 0} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft disabled:opacity-30"><Minus className="w-3 h-3" /></button>}
                          <span className={`text-sm min-w-[1.5rem] text-center tabular-nums ${qtyColor}`}>{isPendingQ ? <Loader2 className="w-3 h-3 animate-spin inline" /> : p.quantita}</span>
                          {canEdit && <button onClick={() => startQ(async () => { await aggiornaQuantitaAction(p.id, 1, categoria); })} disabled={isPendingQ} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft"><PlusIcon className="w-3 h-3" /></button>}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => startN(async () => { await toggleNominativaAction(p.id, !p.nominativa, categoria); })} disabled={isPendingN} className={`p-1.5 rounded transition-colors ${p.nominativa ? 'text-amber bg-amber/10' : 'text-ink-mute hover:bg-bg-soft hover:text-amber'}`} title="Nominativa">{isPendingN ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}</button>
                            <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-bg-soft text-ink-mute hover:text-ink"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { if (!confirm(`Eliminare "${p.principio_attivo}"?`)) return; startDel(async () => { await deleteProdottoAction(p.id, categoria); }); }} disabled={isPendingDel} className="p-1.5 rounded hover:bg-bg-soft text-ink-mute hover:text-abx">{isPendingDel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(docsLiberi.length > 0 || canEdit) && (
        <div className="border-t border-line pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-soft text-sm">Altri documenti</h2>
            {canEdit && <UploadButton categoria={categoria} orgId={orgId} />}
          </div>
          <DocumentiList documenti={docsLiberi} orgId={orgId} categoria={categoria} canDelete={canEdit} />
        </div>
      )}
    </div>
  );
}
