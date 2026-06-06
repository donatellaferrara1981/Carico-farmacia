'use client';

import { useState, useTransition } from 'react';
import { Plus, FileText, Pencil, Trash2, Minus, Plus as PlusIcon, Loader2, Tag, RotateCcw, CalendarPlus, MoreVertical, ShieldAlert, PackageOpen, MapPin } from 'lucide-react';
import { formaLabel, type ProdottoConDocumenti } from '@/lib/prodotti';
import { classificaFarmaco, CLASSE_LABEL } from '@/lib/antibiotici';
import { SALE, getSala } from '@/lib/sale';
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

// ─── Card mobile ──────────────────────────────────────────────────────────────
function CardProdotto({ prodotto, categoria, canEdit, giorni, moltiplicatore = 1 }: {
  prodotto: ProdottoConDocumenti;
  categoria: CategoriaArticolo;
  canEdit: boolean;
  giorni: number;
  moltiplicatore?: number;
}) {
  const [editing, setEditing]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPendingDel, startDel] = useTransition();
  const [isPendingQ, startQ]     = useTransition();
  const [isPendingN, startN]     = useTransition();

  const fabbisogno  = Math.ceil((prodotto.consumo_giornaliero ?? 1) * moltiplicatore * giorni);
  const daOrdinare  = Math.max(0, fabbisogno - prodotto.quantita);
  const abx         = classificaFarmaco(prodotto.principio_attivo);
  const sala        = getSala(prodotto.sala);

  const qtyColor =
    prodotto.quantita === 0 ? 'text-abx' :
    prodotto.quantita <= 3  ? 'text-amber' : 'text-forest';

  return (
    <>
      {editing && <ProdottoForm orgId={prodotto.org_id} categoria={categoria} prodotto={prodotto} onClose={() => setEditing(false)} />}
      <div className={`rounded-xl border bg-bg-card p-3.5 ${prodotto.nominativa ? 'border-amber/40' : abx.isAntibiotico ? 'border-red-200' : 'border-line'}`}>
        {/* Riga 1: nome + azioni */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {abx.isAntibiotico && <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              <p className={`text-sm font-semibold leading-snug ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>
                {prodotto.principio_attivo}
                {prodotto.nome_commerciale && <span className="text-ink-mute font-normal"> · {prodotto.nome_commerciale}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-forest-tint text-forest font-medium">{formaLabel(prodotto.forma_farmaceutica)}</span>
              {prodotto.dosaggio && <span className="text-xs text-ink-mute">{prodotto.dosaggio}</span>}
              {prodotto.nominativa && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber/20 text-amber font-medium border border-amber/40">nominativa</span>}
              {abx.isAntibiotico && abx.classe && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">{CLASSE_LABEL[abx.classe]}</span>
              )}
              {sala && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${sala.colore}`}>
                  <MapPin className="w-2.5 h-2.5" />{sala.label}
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
                  <div className="absolute right-0 top-8 z-20 bg-bg-card rounded-xl shadow-xl border border-line w-44 py-1 overflow-hidden">
                    <button
                      onClick={() => { setMenuOpen(false); startN(async () => { await toggleNominativaAction(prodotto.id, !prodotto.nominativa, categoria); }); }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft flex items-center gap-2"
                    >
                      <Tag className="w-3.5 h-3.5 text-amber" />
                      {prodotto.nominativa ? 'Rimuovi nominativa' : 'Segna nominativa'}
                    </button>
                    <button onClick={() => { setMenuOpen(false); setEditing(true); }} className="w-full px-4 py-2.5 text-sm text-left hover:bg-bg-soft flex items-center gap-2">
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
        <div className="grid grid-cols-3 gap-2 mt-1">
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
                <button onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, -1, categoria); })} disabled={isPendingQ || prodotto.quantita === 0}
                  className="w-5 h-5 rounded border border-line flex items-center justify-center text-ink-mute disabled:opacity-30 active:bg-bg-soft">
                  <Minus className="w-3 h-3" />
                </button>
              )}
              <span className={`text-base font-bold tabular-nums ${qtyColor}`}>
                {isPendingQ ? <Loader2 className="w-4 h-4 animate-spin inline" /> : prodotto.quantita}
              </span>
              {canEdit && (
                <button onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, 1, categoria); })} disabled={isPendingQ}
                  className="w-5 h-5 rounded border border-line flex items-center justify-center text-ink-mute active:bg-bg-soft">
                  <PlusIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {daOrdinare > 0 && (
          <p className="text-xs text-abx font-medium mt-2 text-center">Da ordinare: {daOrdinare} pz</p>
        )}

        {/* Banner consegna parziale */}
        {prodotto.ciclo_totale && prodotto.ciclo_totale > 0 && (() => {
          const consumo = prodotto.consumo_giornaliero ?? 1;
          const giorniRim = consumo > 0 ? Math.floor(prodotto.quantita / consumo) : null;
          const mancante = Math.max(0, prodotto.ciclo_totale - prodotto.quantita);
          const dataEsaur = giorniRim !== null
            ? new Date(Date.now() + giorniRim * 86400000).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
            : null;
          const urgente = giorniRim !== null && giorniRim <= 2;
          return mancante > 0 ? (
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${urgente ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
              <PackageOpen className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${urgente ? 'text-red-500' : 'text-orange-500'}`} />
              <div className="flex-1">
                <p className={`font-semibold ${urgente ? 'text-red-700' : 'text-orange-700'}`}>
                  {urgente ? 'Richiedere subito la rimanenza' : 'Consegna parziale — da richiedere'}
                </p>
                <p className={`mt-0.5 ${urgente ? 'text-red-600' : 'text-orange-600'}`}>
                  {prodotto.quantita}/{prodotto.ciclo_totale} unità
                  {mancante > 0 && <> · <strong>{mancante} da richiedere</strong></>}
                  {dataEsaur && <> · scorte fino al {dataEsaur}</>}
                  {giorniRim !== null && <> ({giorniRim} gg)</>}
                </p>
              </div>
            </div>
          ) : null;
        })()}
      </div>
    </>
  );
}

// ─── Riga tabella desktop ─────────────────────────────────────────────────────
function RigaProdotto({ prodotto, categoria, canEdit, giorni, moltiplicatore = 1 }: {
  prodotto: ProdottoConDocumenti;
  categoria: CategoriaArticolo;
  canEdit: boolean;
  giorni: number;
  moltiplicatore?: number;
}) {
  const [editing, setEditing]    = useState(false);
  const [isPendingDel, startDel] = useTransition();
  const [isPendingQ, startQ]     = useTransition();
  const [isPendingN, startN]     = useTransition();

  const fabbisogno = Math.ceil((prodotto.consumo_giornaliero ?? 1) * moltiplicatore * giorni);
  const abx        = classificaFarmaco(prodotto.principio_attivo);

  const qtyColor =
    prodotto.quantita === 0 ? 'text-abx font-bold' :
    prodotto.quantita <= 3  ? 'text-amber font-bold' : 'text-forest font-bold';

  return (
    <>
      {editing && <ProdottoForm orgId={prodotto.org_id} categoria={categoria} prodotto={prodotto} onClose={() => setEditing(false)} />}
      <tr className={`border-b border-line/50 hover:bg-bg-soft/40 transition-colors ${abx.isAntibiotico ? 'bg-red-50/40' : ''}`}>
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {abx.isAntibiotico && <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              <span className={`text-sm font-medium ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>{prodotto.principio_attivo}</span>
              {prodotto.nome_commerciale && <span className="text-xs text-ink-mute italic">· {prodotto.nome_commerciale}</span>}
              {prodotto.nominativa && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber/20 text-amber font-medium border border-amber/40">nominativa</span>}
              {abx.isAntibiotico && abx.classe && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">{CLASSE_LABEL[abx.classe]}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-forest-tint text-forest font-medium">{formaLabel(prodotto.forma_farmaceutica)}</span>
              {prodotto.dosaggio && <span className="text-xs text-ink-mute">{prodotto.dosaggio}</span>}
              {/* consegna parziale inline */}
              {prodotto.ciclo_totale && prodotto.ciclo_totale > 0 && (() => {
                const consumo = prodotto.consumo_giornaliero ?? 1;
                const ggRim   = consumo > 0 ? Math.floor(prodotto.quantita / consumo) : null;
                const mancante = Math.max(0, prodotto.ciclo_totale - prodotto.quantita);
                const urgente  = ggRim !== null && ggRim <= 2;
                return mancante > 0 ? (
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${urgente ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                    <PackageOpen className="w-3 h-3" />
                    {mancante} da richiedere{ggRim !== null ? ` · ${ggRim} gg` : ''}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-center tabular-nums">
          <span className="text-sm font-semibold text-ink">{prodotto.consumo_giornaliero ?? 1}</span>
          <span className="text-xs text-ink-mute">/die</span>
        </td>
        <td className="px-3 py-2.5 text-center tabular-nums">
          <span className="text-sm font-semibold text-forest">{fabbisogno}</span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 justify-center">
            {canEdit && <button onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, -1, categoria); })} disabled={isPendingQ || prodotto.quantita === 0} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft disabled:opacity-30"><Minus className="w-3 h-3" /></button>}
            <span className={`text-sm min-w-[1.5rem] text-center tabular-nums ${qtyColor}`}>{isPendingQ ? <Loader2 className="w-3 h-3 animate-spin inline" /> : prodotto.quantita}</span>
            {canEdit && <button onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, 1, categoria); })} disabled={isPendingQ} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft"><PlusIcon className="w-3 h-3" /></button>}
          </div>
        </td>
        {canEdit && (
          <td className="px-2 py-2.5">
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startN(async () => { await toggleNominativaAction(prodotto.id, !prodotto.nominativa, categoria); })} disabled={isPendingN}
                className={`p-1.5 rounded transition-colors ${prodotto.nominativa ? 'text-amber bg-amber/10' : 'text-ink-mute hover:bg-bg-soft hover:text-amber'}`} title="Nominativa">
                {isPendingN ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-bg-soft text-ink-mute hover:text-ink"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => { if (!confirm(`Eliminare "${prodotto.principio_attivo}"?`)) return; startDel(async () => { await deleteProdottoAction(prodotto.id, categoria); }); }}
                disabled={isPendingDel} className="p-1.5 rounded hover:bg-bg-soft text-ink-mute hover:text-abx">
                {isPendingDel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </td>
        )}
      </tr>
    </>
  );
}

const PRESET_GIORNI = [
  { label: '7 gg',  value: 7  },
  { label: '14 gg', value: 14 },
  { label: '30 gg', value: 30 },
];

// ─── Vista principale ─────────────────────────────────────────────────────────
export function ProdottiView({ prodotti, docsLiberi, orgId, categoria, canEdit }: Props) {
  const [showForm, setShowForm]         = useState(false);
  const [showPiano, setShowPiano]       = useState(false);
  const [giorni, setGiorni]             = useState(7);
  const [customGiorni, setCustomGiorni] = useState('');
  const [modoCustom, setModoCustom]     = useState(false);
  const [pazienti, setPazienti]         = useState(1);
  const [salaFiltro, setSalaFiltro]     = useState<string | null>(null); // null = tutte
  const [isPendingReset, startReset]    = useTransition();

  const giorniEffettivi = modoCustom ? (parseInt(customGiorni) || 1) : giorni;
  const moltiplicatore  = categoria === 'sanitario' ? Math.max(1, pazienti) : 1;

  // Determina se ci sono prodotti con sala assegnata
  const hasSale = prodotti.some((p) => p.sala);

  const prodottiFiltrati = salaFiltro === null
    ? prodotti
    : prodotti.filter((p) => p.sala === salaFiltro);

  const ordinati = [...prodottiFiltrati].sort((a, b) =>
    a.principio_attivo.localeCompare(b.principio_attivo) ||
    a.forma_farmaceutica.localeCompare(b.forma_farmaceutica)
  );

  // Sale con almeno un prodotto
  const saleConProdotti = SALE.filter((s) => prodotti.some((p) => p.sala === s.id));

  const salaAttiva = getSala(salaFiltro);

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { if (!confirm('Eliminare tutti i prodotti dalla tabella?')) return; startReset(async () => { await svuotaProdottiAction(orgId, categoria); }); }}
              disabled={isPendingReset || prodotti.length === 0}
              className="btn-ghost text-abx hover:bg-abx/10 text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Svuota prodotti
            </button>
            <button
              onClick={() => { if (!confirm('Eliminare tutti i documenti allegati?')) return; startReset(async () => { await svuotaDocumentiAction(orgId, categoria); }); }}
              disabled={isPendingReset || docsLiberi.length === 0}
              className="btn-ghost text-abx hover:bg-abx/10 text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Svuota documenti
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuovo prodotto
          </button>
        </div>
      )}

      {showForm && <ProdottoForm orgId={orgId} categoria={categoria} onClose={() => setShowForm(false)} />}

      {/* Tab sale */}
      {hasSale && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSalaFiltro(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              salaFiltro === null ? 'bg-ink text-bg border-ink' : 'border-line text-ink-soft hover:border-ink/40'
            }`}
          >
            Tutte le sale
            <span className="text-[10px] opacity-70">({prodotti.length})</span>
          </button>
          {saleConProdotti.map((s) => {
            const count = prodotti.filter((p) => p.sala === s.id).length;
            return (
              <button
                key={s.id}
                onClick={() => setSalaFiltro(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  salaFiltro === s.id
                    ? 'bg-ink text-bg border-ink'
                    : 'border-line text-ink-soft hover:border-ink/40'
                }`}
              >
                <MapPin className="w-3 h-3" />
                {s.label}
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Banner sala attiva con giorno rifornimento */}
      {salaAttiva && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm ${salaAttiva.colore}`}>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{salaAttiva.label}</span>
          </div>
          <span className="text-xs font-medium opacity-80">
            Rifornimento ogni <strong>{salaAttiva.giornoRifornimento}</strong>
          </span>
        </div>
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
            <span className="text-xs font-medium text-ink-soft">Fabbisogno per:</span>
            {PRESET_GIORNI.map((p) => (
              <button key={p.value} onClick={() => { setGiorni(p.value); setModoCustom(false); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !modoCustom && giorni === p.value ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
                }`}
              >{p.label}</button>
            ))}
            <button onClick={() => setModoCustom(true)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                modoCustom ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
              }`}
            >Personalizzato</button>
            {modoCustom && (
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={365} value={customGiorni} onChange={(e) => setCustomGiorni(e.target.value)}
                  placeholder="gg" className="w-16 px-2 py-1 text-xs border border-line rounded-lg text-center focus:outline-none focus:border-forest" autoFocus />
                <span className="text-xs text-ink-mute">giorni</span>
              </div>
            )}
            {categoria === 'sanitario' && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-line">
                <span className="text-xs font-medium text-ink-soft">Pazienti:</span>
                <button onClick={() => setPazienti((v) => Math.max(1, v - 1))} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft text-xs font-bold">−</button>
                <input type="number" min={1} value={pazienti} onChange={(e) => setPazienti(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 px-1 py-1 text-xs border border-line rounded-lg text-center font-semibold focus:outline-none focus:border-forest" />
                <button onClick={() => setPazienti((v) => v + 1)} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft text-xs font-bold">+</button>
              </div>
            )}
            {ordinati.length > 0 && (
              <button onClick={() => setShowPiano(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-forest/40 text-forest hover:bg-forest hover:text-white transition-colors">
                <CalendarPlus className="w-3.5 h-3.5" /> Salva nel calendario
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
                consumo_giornaliero: (p.consumo_giornaliero ?? 1) * moltiplicatore,
                fabbisogno: Math.ceil((p.consumo_giornaliero ?? 1) * moltiplicatore * giorniEffettivi),
                quantita_disponibile: p.quantita,
                da_ordinare: Math.max(0, Math.ceil((p.consumo_giornaliero ?? 1) * moltiplicatore * giorniEffettivi) - p.quantita),
              }))}
              onClose={() => setShowPiano(false)}
            />
          )}

          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {ordinati.map((p) => (
              <CardProdotto key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} giorni={giorniEffettivi} moltiplicatore={moltiplicatore} />
            ))}
          </div>

          {/* Desktop: tabella */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-soft border-b border-line">
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide">Farmaco</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">/die</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-forest uppercase tracking-wide text-center">
                    {giorniEffettivi} gg{moltiplicatore > 1 ? ` × ${moltiplicatore} paz.` : ''}
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">Scorte</th>
                  {canEdit && <th className="px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {ordinati.map((p) => (
                  <RigaProdotto key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} giorni={giorniEffettivi} moltiplicatore={moltiplicatore} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Documenti */}
      {(docsLiberi.length > 0 || canEdit) && (
        <div className="border-t border-line pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-soft text-sm">Documenti caricati</h2>
            {canEdit && <UploadButton categoria={categoria} orgId={orgId} />}
          </div>
          <DocumentiList documenti={docsLiberi} orgId={orgId} categoria={categoria} canDelete={canEdit} />
        </div>
      )}
    </div>
  );
}
