'use client';

import React, { useState, useTransition } from 'react';
import { Plus, FileText, Pencil, Trash2, Minus, Plus as PlusIcon, Loader2, Tag, RotateCcw, CalendarPlus, MoreVertical, ShieldAlert, PackageOpen, MapPin, ArrowUpDown, Check, X } from 'lucide-react';
import { formaLabel, type ProdottoConDocumenti } from '@/lib/prodotti';
import { classificaFarmaco, isAltoCosto, CLASSE_LABEL } from '@/lib/antibiotici';
import { SALE, getSala } from '@/lib/sale';
import { ProdottoForm } from '@/components/prodotto-form';
import { SalvaPianoModal } from '@/components/salva-piano-modal';
import { DocumentiList } from '@/components/documenti-list';
import { UploadButton } from '@/components/upload-button';
import { deleteProdottoAction, aggiornaQuantitaAction, toggleNominativaAction, svuotaProdottiAction, aggiornaDataRichiestaAction } from '@/app/(app)/[categoria]/prodotti-actions';
import { svuotaDocumentiAction } from '@/app/(app)/[categoria]/actions';
import { eliminaTuttiPazientiUoAction } from '@/app/(app)/pazienti/actions';
import type { CategoriaArticolo } from '@/lib/types';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';
import { CAT_LABELS } from '@/lib/types';

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
  uoAttivaId?: string | null;
  pazienti?: { id: string; nominativo: string; sala: string; numero_letto: number; piano?: string | null }[];
  terapiePazienti?: { paziente_id: string; principio_attivo: string; dosaggio: string | null; tipo: string }[];
}

// ─── Riga compatta (tutti gli schermi) ────────────────────────────────────────
function RigaCompatta({ prodotto, categoria, canEdit, giorni, moltiplicatore = 1, consumoOverride }: {
  prodotto: ProdottoConDocumenti;
  categoria: CategoriaArticolo;
  canEdit: boolean;
  giorni: number;
  moltiplicatore?: number;
  consumoOverride?: number;
}) {
  const [editing, setEditing]    = useState(false);
  const [menuOpen, setMenuOpen]  = useState(false);
  const [showNome, setShowNome]  = useState(false);
  const [editQty, setEditQty]    = useState(false);
  const [draftQty, setDraftQty]  = useState('');
  const [isPendingDel, startDel] = useTransition();
  const [isPendingQ, startQ]     = useTransition();
  const [isPendingN, startN]     = useTransition();

  const consumo    = consumoOverride ?? prodotto.consumo_giornaliero ?? 0;
  const fabbisogno = Math.ceil(consumo * moltiplicatore * giorni);
  const qty        = prodotto.quantita;
  const daOrdinare = Math.max(0, fabbisogno - qty);
  const abx        = classificaFarmaco(prodotto.principio_attivo);
  const altoCosto  = abx.isAntibiotico && isAltoCosto(prodotto.principio_attivo);

  const qtyColor =
    qty === 0 ? 'text-abx font-bold' :
    qty <= 3  ? 'text-amber font-bold' : 'text-forest font-bold';

  function openQty() { setDraftQty(String(qty)); setEditQty(true); }
  function saveQty() {
    const n = parseInt(draftQty, 10);
    if (isNaN(n) || n < 0) { setEditQty(false); return; }
    const delta = n - qty;
    if (delta !== 0) {
      startQ(async () => { await aggiornaQuantitaAction(prodotto.id, delta, categoria); });
    }
    setEditQty(false);
  }

  return (
    <>
      {editing && <ProdottoForm orgId={prodotto.org_id} categoria={categoria} prodotto={prodotto} onClose={() => setEditing(false)} />}
      <div className={`flex flex-col border-b border-line last:border-0 ${altoCosto ? 'bg-orange-50/40' : abx.isAntibiotico ? 'bg-red-50/30' : ''}`}>
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-bg-soft/60 group">

          {/* Nome */}
          <button
            onMouseEnter={() => setShowNome(true)}
            onMouseLeave={() => setShowNome(false)}
            onTouchStart={() => setShowNome((v) => !v)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-1 min-w-0">
              {abx.isAntibiotico && <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />}
              <p className={`text-xs font-medium leading-snug truncate ${altoCosto ? 'text-orange-700 underline decoration-dotted' : abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>
                {prodotto.principio_attivo}
              </p>
              {prodotto.nominativa && <span className="shrink-0 text-[9px] px-1 py-0.5 rounded-full bg-amber/20 text-amber border border-amber/30">nom.</span>}
            </div>
            {altoCosto && (
              <p className="text-[9px] text-orange-600 font-medium leading-none mt-0.5">⚠ prescrizione motivata</p>
            )}
            <div className="flex items-center gap-1 flex-wrap">
              {abx.isAntibiotico && abx.classe && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-semibold border border-red-200 shrink-0">
                  {CLASSE_LABEL[abx.classe]}
                </span>
              )}
              <p className="text-[10px] text-ink-mute truncate">
                {formaLabel(prodotto.forma_farmaceutica)}{prodotto.dosaggio ? ` ${prodotto.dosaggio}` : ''}{prodotto.nome_commerciale ? ` · ${prodotto.nome_commerciale}` : ''}
              </p>
            </div>
          </button>

          {/* /die */}
          <div className="shrink-0 w-10 text-center">
            <p className="text-[10px] text-ink-mute leading-none">/die</p>
            <p className="text-xs font-semibold text-ink-soft tabular-nums">{consumo > 0 ? consumo : '—'}</p>
          </div>

          {/* fabbisogno */}
          <div className="shrink-0 w-10 text-center">
            <p className="text-[10px] text-forest leading-none">{giorni}gg</p>
            <p className={`text-xs font-bold tabular-nums ${daOrdinare > 0 ? 'text-abx' : 'text-forest'}`}>
              {fabbisogno > 0 ? fabbisogno : '—'}
            </p>
          </div>

          {/* scorte — cliccabile per editare */}
          <div className="shrink-0 w-16">
            {editQty && canEdit ? (
              <div className="flex items-center gap-0.5">
                <input
                  autoFocus
                  type="number"
                  min={0}
                  className="w-12 text-xs text-center border border-forest rounded px-1 py-0.5 bg-bg outline-none"
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveQty(); if (e.key === 'Escape') setEditQty(false); }}
                />
                {isPendingQ
                  ? <Loader2 className="w-3 h-3 animate-spin text-forest" />
                  : <>
                      <button onClick={saveQty} className="text-forest"><Check className="w-3 h-3" /></button>
                      <button onClick={() => setEditQty(false)} className="text-ink-mute"><X className="w-3 h-3" /></button>
                    </>
                }
              </div>
            ) : (
              <button
                onClick={canEdit ? openQty : undefined}
                className="w-full flex flex-col items-end"
                disabled={!canEdit}
              >
                <p className="text-[10px] text-ink-mute leading-none">scorte</p>
                <p className={`text-sm tabular-nums ${qtyColor}`}>
                  {isPendingQ ? <Loader2 className="w-3 h-3 animate-spin inline" /> : qty}
                </p>
              </button>
            )}
          </div>

          {/* Azioni hover */}
          {canEdit && (
            <div className="relative opacity-0 group-hover:opacity-100 transition-all shrink-0">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded hover:bg-bg text-ink-mute hover:text-ink">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-6 z-20 bg-bg-card rounded-xl shadow-xl border border-line w-44 py-1 overflow-hidden">
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

        {/* Tooltip nome completo */}
        {showNome && (
          <div className="px-3 pb-2 pt-0.5 bg-ink/5 border-t border-line/50">
            <p className={`text-xs font-semibold ${altoCosto ? 'text-orange-700' : 'text-ink'}`}>{prodotto.principio_attivo}</p>
            {abx.isAntibiotico && abx.classe && (
              <p className="text-[10px] text-red-600 mt-0.5">{CLASSE_LABEL[abx.classe]}</p>
            )}
            {altoCosto && (
              <p className="text-[10px] text-orange-600 font-semibold mt-0.5">⚠ Alto costo — richiede prescrizione motivata</p>
            )}
            {prodotto.nome_commerciale && <p className="text-[11px] text-ink-mute mt-0.5">{prodotto.nome_commerciale}</p>}
            {prodotto.ciclo_totale && prodotto.ciclo_totale > 0 && (() => {
              const mancante = Math.max(0, prodotto.ciclo_totale - qty);
              if (!mancante) return null;
              const ggRim = consumo > 0 ? Math.floor(qty / consumo) : null;
              const urgente = ggRim !== null && ggRim <= 2;
              return (
                <div className={`mt-1 flex items-center gap-1 text-[10px] ${urgente ? 'text-red-600' : 'text-orange-600'}`}>
                  <PackageOpen className="w-3 h-3 shrink-0" />
                  {qty}/{prodotto.ciclo_totale} · {mancante} da richiedere{ggRim !== null ? ` · ${ggRim} gg` : ''}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Riga nominativa con semaforo rinnovo ─────────────────────────────────────
function RigaNominativa({ prodotto, categoria }: { prodotto: ProdottoConDocumenti; categoria: CategoriaArticolo }) {
  const [editData, setEditData]       = useState(false);
  const [editGiorni, setEditGiorni]   = useState(false);
  const [draftData, setDraftData]     = useState(prodotto.data_ultima_richiesta ?? '');
  const [draftGiorni, setDraftGiorni] = useState(String(prodotto.giorni_validita_richiesta ?? 30));
  const [isPending, start]            = useTransition();

  const dataRichiesta = prodotto.data_ultima_richiesta;
  const giorniVal     = prodotto.giorni_validita_richiesta ?? 30;

  // Calcola stato semaforo
  let stato: 'ok' | 'imminente' | 'scaduto' | 'nessuna' = 'nessuna';
  let giorniMancanti: number | null = null;
  if (dataRichiesta) {
    const scad = new Date(dataRichiesta);
    scad.setDate(scad.getDate() + giorniVal);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    giorniMancanti = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000);
    stato = giorniMancanti < 0 ? 'scaduto' : giorniMancanti <= 7 ? 'imminente' : 'ok';
  }

  function salva() {
    if (!draftData) { setEditData(false); return; }
    const g = Math.max(1, parseInt(draftGiorni) || 30);
    start(async () => {
      await aggiornaDataRichiestaAction(prodotto.id, draftData, g, categoria);
      setEditData(false);
      setEditGiorni(false);
    });
  }

  const semaforoClass =
    stato === 'ok'        ? 'bg-forest text-white' :
    stato === 'imminente' ? 'bg-amber text-white'  :
    stato === 'scaduto'   ? 'bg-abx text-white'    : 'bg-bg-soft text-ink-mute border border-line';

  const semaforoLabel =
    stato === 'ok'        ? `✓ ${giorniMancanti}gg` :
    stato === 'imminente' ? `⚠ ${giorniMancanti}gg` :
    stato === 'scaduto'   ? `✕ scad.`               : 'nessuna data';

  return (
    <div className="flex flex-col border-b border-line last:border-0 bg-amber/5">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Nome */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-amber-800 truncate">{prodotto.principio_attivo}</p>
          {(() => {
            const abx = classificaFarmaco(prodotto.principio_attivo);
            return (
              <div className="flex items-center gap-1 flex-wrap">
                {abx.isAntibiotico && abx.classe && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-semibold border border-red-200 shrink-0">
                    {CLASSE_LABEL[abx.classe]}
                  </span>
                )}
                <p className="text-[10px] text-ink-mute truncate">
                  {formaLabel(prodotto.forma_farmaceutica)}{prodotto.dosaggio ? ` ${prodotto.dosaggio}` : ''}
                  {prodotto.nome_commerciale ? ` · ${prodotto.nome_commerciale}` : ''}
                </p>
              </div>
            );
          })()}
        </div>

        {/* Semaforo stato */}
        <button
          onClick={() => setEditData(true)}
          title="Modifica data ultima richiesta"
          className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full tabular-nums ${semaforoClass}`}
        >
          {semaforoLabel}
        </button>

        {/* Data ultima richiesta */}
        <div className="shrink-0 text-right">
          {editData ? (
            <div className="flex flex-col gap-1 items-end">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-ink-mute">Data:</span>
                <input
                  type="date"
                  autoFocus
                  value={draftData}
                  onChange={(e) => setDraftData(e.target.value)}
                  className="text-xs border border-forest rounded px-1 py-0.5 bg-bg outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-ink-mute">Validità (gg):</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={draftGiorni}
                  onChange={(e) => setDraftGiorni(e.target.value)}
                  className="w-14 text-xs border border-forest rounded px-1 py-0.5 bg-bg outline-none text-center"
                />
              </div>
              <div className="flex gap-1">
                {isPending
                  ? <Loader2 className="w-3 h-3 animate-spin text-forest" />
                  : <>
                      <button onClick={salva} className="text-[10px] px-2 py-0.5 rounded bg-forest text-white">Salva</button>
                      <button onClick={() => setEditData(false)} className="text-[10px] px-2 py-0.5 rounded border border-line text-ink-mute">✕</button>
                    </>
                }
              </div>
            </div>
          ) : (
            <button onClick={() => { setDraftData(dataRichiesta ?? ''); setEditData(true); }} className="text-right">
              {dataRichiesta ? (
                <>
                  <p className="text-[10px] text-ink-mute leading-none">ultima richiesta</p>
                  <p className="text-xs font-medium text-ink tabular-nums">
                    {new Date(dataRichiesta).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-ink-mute">ogni {giorniVal}gg</p>
                </>
              ) : (
                <p className="text-[10px] text-ink-mute underline decoration-dotted">aggiungi data</p>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const PRESET_GIORNI = [
  { label: '7 gg',  value: 7  },
  { label: '14 gg', value: 14 },
  { label: '30 gg', value: 30 },
];

// ─── Vista principale ─────────────────────────────────────────────────────────
export function ProdottiView({ prodotti, docsLiberi, orgId, categoria, canEdit, uoAttivaId, pazienti = [], terapiePazienti = [] }: Props) {
  const [showForm, setShowForm]               = useState(false);
  const [showPiano, setShowPiano]             = useState(false);
  const [giorni, setGiorni]                   = useState(7);
  const [customGiorni, setCustomGiorni]       = useState('');
  const [modoCustom, setModoCustom]           = useState(false);
  const [numPazienti, setNumPazienti]         = useState(1);
  const [salaFiltro, setSalaFiltro]           = useState<string | null>(null);
  const [ordine, setOrdine]                   = useState<'alfa' | 'fabb'>('alfa');
  const [isPendingReset, startReset]          = useTransition();
  const [pazienteId, setPazienteId]           = useState<string | 'tutti'>('tutti');
  const [pianoFiltro, setPianoFiltro]         = useState<string | null>(null);

  const giorniEffettivi = modoCustom ? (parseInt(customGiorni) || 1) : giorni;
  const moltiplicatore  = categoria === 'sanitario' ? Math.max(1, numPazienti) : 1;

  // Piani disponibili (solo terapie con pazienti multi-piano)
  const pianiDisponibili = categoria === 'terapie'
    ? [...new Set(pazienti.map((p) => p.piano).filter(Boolean) as string[])].sort()
    : [];

  // Pazienti filtrati per piano
  const pazientiSulPiano = pianoFiltro === null
    ? pazienti
    : pazienti.filter((p) => p.piano === pianoFiltro);
  const idsPazientiSulPiano = new Set(pazientiSulPiano.map((p) => p.id));

  // Per-piano consumo: stima proporzionale dal conteggio pazienti in terapie_pazienti
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const pianoConsumoMap = new Map<string, number>();
  if (pianoFiltro !== null && categoria === 'terapie') {
    for (const prod of prodotti) {
      const allTP = terapiePazienti.filter((t) =>
        norm(t.principio_attivo) === norm(prod.principio_attivo)
      );
      const totalCount = allTP.length;
      const floorCount = allTP.filter((t) => idsPazientiSulPiano.has(t.paziente_id)).length;
      if (floorCount > 0 && totalCount > 0) {
        pianoConsumoMap.set(prod.id, Math.max(1, Math.ceil((prod.consumo_giornaliero ?? 0) * floorCount / totalCount)));
      }
    }
  }

  // Filtro per paziente selezionato (solo terapie)
  const farmacilPaziente = pazienteId === 'tutti'
    ? null
    : terapiePazienti.filter((t) => t.paziente_id === pazienteId).map((t) =>
        norm(t.principio_attivo)
      );

  const prodottiFiltroBase = (() => {
    let base = prodotti;
    // Filtro piano: solo prodotti usati da pazienti sul piano selezionato
    if (pianoFiltro !== null && categoria === 'terapie') {
      const drugsOnFloor = new Set(
        terapiePazienti
          .filter((t) => idsPazientiSulPiano.has(t.paziente_id))
          .map((t) => norm(t.principio_attivo))
      );
      base = base.filter((p) => drugsOnFloor.has(norm(p.principio_attivo)));
    }
    // Filtro paziente singolo
    if (farmacilPaziente !== null) {
      base = base.filter((p) => farmacilPaziente.some((k) => k.includes(norm(p.principio_attivo))));
    }
    return base;
  })();

  const hasSale = prodotti.some((p) => p.sala);
  const prodottiFiltrati = salaFiltro === null ? prodottiFiltroBase : prodottiFiltroBase.filter((p) => p.sala === salaFiltro);
  const saleConProdotti = SALE.filter((s) => prodotti.some((p) => p.sala === s.id));
  const salaAttiva = getSala(salaFiltro);

  const ordinati = [...prodottiFiltrati].sort((a, b) => {
    const abxA = classificaFarmaco(a.principio_attivo).isAntibiotico;
    const abxB = classificaFarmaco(b.principio_attivo).isAntibiotico;
    // Ordine gruppi: antibiotici → nominative non-abx → altri
    const groupA = abxA ? 0 : a.nominativa ? 1 : 2;
    const groupB = abxB ? 0 : b.nominativa ? 1 : 2;
    if (groupA !== groupB) return groupA - groupB;
    if (ordine === 'alfa') return a.principio_attivo.localeCompare(b.principio_attivo, 'it') || a.forma_farmaceutica.localeCompare(b.forma_farmaceutica);
    const fa = Math.ceil((a.consumo_giornaliero ?? 0) * moltiplicatore * giorniEffettivi);
    const fb = Math.ceil((b.consumo_giornaliero ?? 0) * moltiplicatore * giorniEffettivi);
    return fb - fa;
  });

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
            {uoAttivaId && (
              <button
                onClick={() => { if (!confirm('Eliminare tutti i degenti di questa UO?')) return; startReset(async () => { await eliminaTuttiPazientiUoAction(orgId, uoAttivaId!); }); }}
                disabled={isPendingReset || pazienti.length === 0}
                className="btn-ghost text-abx hover:bg-abx/10 text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                {isPendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Svuota degenti
              </button>
            )}
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuovo prodotto
          </button>
        </div>
      )}

      {showForm && <ProdottoForm orgId={orgId} categoria={categoria} onClose={() => setShowForm(false)} />}

      {/* Filtro sale */}
      {hasSale && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSalaFiltro(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              salaFiltro === null ? 'bg-ink text-bg border-ink' : 'border-line text-ink-soft hover:border-ink/40'
            }`}
          >
            Tutte <span className="opacity-70">({prodotti.length})</span>
          </button>
          {saleConProdotti.map((s) => {
            const count = prodotti.filter((p) => p.sala === s.id).length;
            return (
              <button key={s.id} onClick={() => setSalaFiltro(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  salaFiltro === s.id ? 'bg-ink text-bg border-ink' : 'border-line text-ink-soft hover:border-ink/40'
                }`}
              >
                <MapPin className="w-3 h-3" />{s.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {salaAttiva && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm ${salaAttiva.colore}`}>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{salaAttiva.label}</span>
          </div>
          <span className="text-xs font-medium opacity-80">Rifornimento ogni <strong>{salaAttiva.giornoRifornimento}</strong></span>
        </div>
      )}

      {/* Selettore piano (solo terapie multi-piano) */}
      {categoria === 'terapie' && pianiDisponibili.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-ink-soft">Piano:</span>
          <button
            onClick={() => { setPianoFiltro(null); setPazienteId('tutti'); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pianoFiltro === null ? 'bg-ink text-bg border-ink' : 'border-line text-ink-soft hover:border-ink/40'}`}
          >
            Tutti i piani
          </button>
          {pianiDisponibili.map((piano) => {
            const label = piano === 'terra' ? 'Piano Terra' : piano === 'primo' ? 'Primo Piano' : `Piano ${piano}`;
            const count = pazienti.filter((p) => p.piano === piano).length;
            return (
              <button
                key={piano}
                onClick={() => { setPianoFiltro(piano); setPazienteId('tutti'); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pianoFiltro === piano ? 'bg-ink text-bg border-ink' : 'border-line text-ink-soft hover:border-ink/40'}`}
              >
                {label} <span className="opacity-60">({count} paz.)</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selettore paziente (solo terapie) */}
      {categoria === 'terapie' && pazienti.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-ink-soft">Degente:</span>
          <button
            onClick={() => setPazienteId('tutti')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pazienteId === 'tutti' ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/50'}`}
          >
            Tutti
          </button>
          {pazientiSulPiano.map((p) => (
            <button
              key={p.id}
              onClick={() => setPazienteId(p.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${pazienteId === p.id ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/50'}`}
            >
              {p.nominativo} <span className="opacity-60">· L.{p.numero_letto}</span>
            </button>
          ))}
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
          {/* Selettore periodo + pazienti */}
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
                <span className="text-xs font-medium text-ink-soft">Paz.:</span>
                <button onClick={() => setNumPazienti((v) => Math.max(1, v - 1))} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft">−</button>
                <input type="number" min={1} value={numPazienti} onChange={(e) => setNumPazienti(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 px-1 py-1 text-xs border border-line rounded-lg text-center font-semibold focus:outline-none focus:border-forest" />
                <button onClick={() => setNumPazienti((v) => v + 1)} className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft">+</button>
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
                consumo_giornaliero: (p.consumo_giornaliero ?? 0) * moltiplicatore,
                fabbisogno: Math.ceil((p.consumo_giornaliero ?? 0) * moltiplicatore * giorniEffettivi),
                quantita_disponibile: p.quantita,
                da_ordinare: Math.max(0, Math.ceil((p.consumo_giornaliero ?? 0) * moltiplicatore * giorniEffettivi) - p.quantita),
              }))}
              onClose={() => setShowPiano(false)}
            />
          )}

          {/* Stampa / Condividi */}
          {ordinati.length > 0 && (
            <SharePrintBar
              titolo={`${CAT_LABELS[categoria]} — fabbisogno ${giorniEffettivi} gg`}
              testoCondivisione={() => {
                const lines = [`📋 ${CAT_LABELS[categoria]} — ${giorniEffettivi} giorni\n`];
                ordinati.forEach((p) => {
                  const fabb = Math.ceil((p.consumo_giornaliero ?? 0) * moltiplicatore * giorniEffettivi);
                  const ord  = Math.max(0, fabb - p.quantita);
                  lines.push(`• ${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''} — fabb: ${fabb} | disp: ${p.quantita} | ord: ${ord > 0 ? ord : '✓'}`);
                });
                return lines.join('\n');
              }}
              generaHtml={() => {
                const date = new Date().toLocaleDateString('it-IT');
                const righe = ordinati.map((p) => {
                  const fabb = Math.ceil((p.consumo_giornaliero ?? 0) * moltiplicatore * giorniEffettivi);
                  const ord  = Math.max(0, fabb - p.quantita);
                  return `<tr>
                    <td>${p.principio_attivo}${p.nome_commerciale ? ` <span style="color:#6b7280">· ${p.nome_commerciale}</span>` : ''}${p.dosaggio ? ` <small>${p.dosaggio}</small>` : ''}</td>
                    <td class="num">${p.consumo_giornaliero ?? 0}</td>
                    <td class="num green">${fabb}</td>
                    <td class="num">${p.quantita}</td>
                    <td class="num ${ord > 0 ? 'red' : 'green'}">${ord > 0 ? ord : '✓'}</td>
                  </tr>`;
                }).join('');
                const corpo = `<table><thead><tr><th>Farmaco</th><th class="num">/die</th><th class="num">Fabbisogno</th><th class="num">Disponibile</th><th class="num">Da ordinare</th></tr></thead><tbody>${righe}</tbody></table>`;
                return htmlBase(`${CAT_LABELS[categoria]} — fabbisogno ${giorniEffettivi} giorni`, `Stampato il ${date}`, corpo);
              }}
              className="justify-end"
            />
          )}

          {/* Lista compatta */}
          <div className="rounded-xl border border-line bg-bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-bg-soft">
              <ArrowUpDown className="w-3.5 h-3.5 text-ink-mute" />
              <span className="text-xs text-ink-mute mr-1">Ordina:</span>
              <button
                onClick={() => setOrdine('alfa')}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${ordine === 'alfa' ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'}`}
              >A→Z</button>
              <button
                onClick={() => setOrdine('fabb')}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${ordine === 'fabb' ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'}`}
              >Per fabbisogno</button>
              <span className="ml-auto text-[10px] text-ink-mute">{ordinati.length} articoli</span>
            </div>

            {/* Intestazione colonne */}
            <div className="flex items-center gap-2 px-3 py-1 bg-bg-soft/50 border-b border-line">
              <p className="flex-1 text-[10px] text-ink-mute font-medium uppercase tracking-wide">Articolo</p>
              <p className="w-10 text-[10px] text-ink-mute text-center">/die</p>
              <p className="w-10 text-[10px] text-forest text-center">{giorniEffettivi}gg</p>
              <p className="w-16 text-[10px] text-ink-mute text-right">Scorte</p>
              {canEdit && <div className="w-5" />}
            </div>

            {/* Righe con separatori: Antibiotici → Nominative → Altri */}
            {(() => {
              const rows: React.ReactNode[] = [];
              // Separa in gruppi
              const abx  = ordinati.filter((p) => classificaFarmaco(p.principio_attivo).isAntibiotico);
              const nom  = ordinati.filter((p) => !classificaFarmaco(p.principio_attivo).isAntibiotico && p.nominativa);
              const altri = ordinati.filter((p) => !classificaFarmaco(p.principio_attivo).isAntibiotico && !p.nominativa);

              if (abx.length > 0) {
                rows.push(
                  <div key="__abx__" className="px-3 py-1 bg-red-50 border-b border-line">
                    <p className="text-[10px] text-red-700 font-medium uppercase tracking-wide flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Antibiotici / Antifungini / Antivirali
                    </p>
                  </div>
                );
                abx.forEach((p) => rows.push(<RigaCompatta key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} giorni={giorniEffettivi} moltiplicatore={moltiplicatore} consumoOverride={pianoConsumoMap.get(p.id)} />));
              }

              if (nom.length > 0) {
                rows.push(
                  <div key="__nom__" className="px-3 py-1 bg-amber/10 border-b border-line">
                    <p className="text-[10px] text-amber-700 font-medium uppercase tracking-wide flex items-center gap-1">
                      🏷 Terapie nominative — prescrizione individuale
                    </p>
                  </div>
                );
                nom.forEach((p) => rows.push(<RigaNominativa key={p.id} prodotto={p} categoria={categoria} />));
              }

              if (altri.length > 0) {
                rows.push(
                  <div key="__altri__" className="px-3 py-1 bg-bg-soft/80 border-b border-line">
                    <p className="text-[10px] text-ink-mute font-medium uppercase tracking-wide">Altri farmaci</p>
                  </div>
                );
                altri.forEach((p) => rows.push(<RigaCompatta key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} giorni={giorniEffettivi} moltiplicatore={moltiplicatore} consumoOverride={pianoConsumoMap.get(p.id)} />));
              }

              return rows;
            })()}
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
