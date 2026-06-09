'use client';

import { useState, useTransition, useRef, useCallback, useEffect } from 'react';
import { X, Loader2, GripHorizontal, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { FORME_FARMACEUTICHE, type FormaFarmaceutica, type Prodotto } from '@/lib/prodotti';
import { upsertProdottoAction } from '@/app/(app)/[categoria]/prodotti-actions';
import type { CategoriaArticolo } from '@/lib/types';

interface Props {
  orgId: string;
  categoria: CategoriaArticolo;
  prodotto?: Prodotto;
  onClose: () => void;
}

function initialValues(prodotto?: Prodotto) {
  return {
    principio_attivo: prodotto?.principio_attivo ?? '',
    nome_commerciale: prodotto?.nome_commerciale ?? '',
    forma_farmaceutica: prodotto?.forma_farmaceutica ?? 'compressa',
    dosaggio: prodotto?.dosaggio ?? '',
    quantita: String(prodotto?.quantita ?? 0),
    consumo_giornaliero: String(prodotto?.consumo_giornaliero ?? 0),
    soglia_minima: String(prodotto?.soglia_minima ?? ''),
    data_scadenza: prodotto?.data_scadenza ?? '',
    note: prodotto?.note ?? '',
    quantita_consegnata: String((prodotto as any)?.quantita_consegnata ?? ''),
    data_consegna: (prodotto as any)?.data_consegna ?? '',
    alert_esaurimento: (prodotto as any)?.alert_esaurimento !== false,
  };
}

export function ProdottoForm({ orgId, categoria, prodotto, onClose }: Props) {
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState(initialValues(prodotto));
  const [dirty, setDirty] = useState(false);
  const [showConsegna, setShowConsegna] = useState(
    !!(prodotto as any)?.quantita_consegnata || !!(prodotto as any)?.data_consegna,
  );

  // Dragging
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: rect.left, py: rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    setPos({ x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy });
  }, []);

  const onDragEnd = useCallback(() => { dragging.current = false; }, []);

  function set(field: string, value: string | boolean) {
    setVals(v => ({ ...v, [field]: value }));
    setDirty(true);
  }

  function resetForm() {
    setVals(initialValues(prodotto));
    setDirty(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const principio_attivo = vals.principio_attivo.trim();
    if (!principio_attivo) { setError('Inserisci il principio attivo.'); return; }
    setError(null);
    start(async () => {
      const soglia = parseInt(vals.soglia_minima, 10);
      const qCons = parseInt(vals.quantita_consegnata, 10);
      const res = await upsertProdottoAction(
        orgId, categoria,
        {
          principio_attivo,
          nome_commerciale: vals.nome_commerciale,
          forma_farmaceutica: vals.forma_farmaceutica as FormaFarmaceutica,
          dosaggio: vals.dosaggio,
          quantita: Math.max(0, parseInt(vals.quantita, 10) || 0),
          consumo_giornaliero: Math.max(0, parseFloat(vals.consumo_giornaliero) || 0),
          soglia_minima: isNaN(soglia) ? null : Math.max(0, soglia),
          data_scadenza: vals.data_scadenza,
          note: vals.note,
          quantita_consegnata: isNaN(qCons) ? null : qCons,
          data_consegna: vals.data_consegna || null,
          alert_esaurimento: vals.alert_esaurimento,
        } as any,
        prodotto?.id,
      );
      if (res && 'error' in res) { setError(res.error ?? 'Errore.'); return; }
      onClose();
    });
  }

  // Calcola data esaurimento stimata
  const qCons = parseInt(vals.quantita_consegnata, 10);
  const consGio = parseFloat(vals.consumo_giornaliero);
  const dataConsegna = vals.data_consegna;
  let dataEsaurimento: string | null = null;
  if (qCons > 0 && consGio > 0 && dataConsegna) {
    const d = new Date(dataConsegna);
    d.setDate(d.getDate() + Math.ceil(qCons / consGio));
    dataEsaurimento = d.toLocaleDateString('it-IT');
  }

  const panelStyle = pos
    ? { position: 'fixed' as const, left: pos.x, top: pos.y, zIndex: 60 }
    : { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 60 };

  return (
    <>
      {/* Overlay sfondo — solo se non spostato */}
      {!pos && <div className="fixed inset-0 z-50 bg-black/30" onClick={() => { if (!dirty || confirm('Hai modifiche non salvate. Uscire?')) onClose(); }} />}

      <div
        ref={panelRef}
        style={panelStyle}
        className="w-[92vw] max-w-sm bg-bg-card rounded-xl shadow-2xl border border-line flex flex-col"
      >
        {/* Header draggabile */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-line bg-bg-soft rounded-t-xl cursor-grab active:cursor-grabbing select-none shrink-0"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <GripHorizontal className="w-4 h-4 text-ink-mute shrink-0" />
          <p className="text-sm font-semibold text-ink flex-1 truncate">
            {prodotto ? prodotto.principio_attivo : 'Nuovo prodotto'}
          </p>
          {dirty && (
            <button
              type="button"
              onClick={resetForm}
              title="Annulla modifiche"
              className="p-1 rounded hover:bg-bg-soft text-amber-500 hover:text-amber-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => { if (!dirty || confirm('Hai modifiche non salvate. Uscire?')) onClose(); }} className="p-1 rounded hover:bg-bg-soft text-ink-mute">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form compatto */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[80vh]">
          <div className="px-3 py-3 space-y-2.5">

            {/* Principio attivo + nome commerciale */}
            <div>
              <label className="label-xs">Principio attivo *</label>
              <input className="input-base text-sm py-1.5" value={vals.principio_attivo}
                onChange={e => set('principio_attivo', e.target.value)} placeholder="es. Paracetamolo" required />
            </div>
            <div>
              <label className="label-xs">Nome commerciale</label>
              <input className="input-base text-sm py-1.5" value={vals.nome_commerciale}
                onChange={e => set('nome_commerciale', e.target.value)} placeholder="es. Tachipirina" />
            </div>

            {/* Forma + dosaggio */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-xs">Forma *</label>
                <select className="input-base text-sm py-1.5" value={vals.forma_farmaceutica}
                  onChange={e => set('forma_farmaceutica', e.target.value)}>
                  {FORME_FARMACEUTICHE.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label-xs">Dosaggio</label>
                <input className="input-base text-sm py-1.5" value={vals.dosaggio}
                  onChange={e => set('dosaggio', e.target.value)} placeholder="es. 500 mg" />
              </div>
            </div>

            {/* Quantità + consumo */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-xs">Scorta attuale</label>
                <input type="number" min={0} className="input-base text-sm py-1.5" value={vals.quantita}
                  onChange={e => set('quantita', e.target.value)} />
              </div>
              <div>
                <label className="label-xs">Consumo/die</label>
                <input type="number" min={0} step="0.5" className="input-base text-sm py-1.5" value={vals.consumo_giornaliero}
                  onChange={e => set('consumo_giornaliero', e.target.value)} placeholder="pz/die" />
              </div>
            </div>

            {/* Soglia + scadenza */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-xs">Soglia alert scorta</label>
                <input type="number" min={0} className="input-base text-sm py-1.5" value={vals.soglia_minima}
                  onChange={e => set('soglia_minima', e.target.value)} placeholder="es. 5" />
              </div>
              <div>
                <label className="label-xs">Scadenza farmaco</label>
                <input type="date" className="input-base text-sm py-1.5" value={vals.data_scadenza}
                  onChange={e => set('data_scadenza', e.target.value)} />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="label-xs">Note</label>
              <textarea rows={2} className="input-base text-sm py-1.5 resize-none" value={vals.note}
                onChange={e => set('note', e.target.value)} placeholder="Note aggiuntive…" />
            </div>

            {/* ── Sezione consegna farmacia ── */}
            <div className="rounded-lg border border-line overflow-hidden">
              <button
                type="button"
                onClick={() => setShowConsegna(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-bg-soft hover:bg-bg-soft/80 text-left"
              >
                {showConsegna ? <ChevronDown className="w-3.5 h-3.5 text-ink-mute" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-mute" />}
                <span className="text-xs font-semibold text-ink-soft">Consegna farmacia + Alert esaurimento</span>
                {dataEsaurimento && <span className="ml-auto text-[10px] text-amber-600 font-medium">esaur. {dataEsaurimento}</span>}
              </button>

              {showConsegna && (
                <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-line">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label-xs">Qtà consegnata (pz)</label>
                      <input type="number" min={0} className="input-base text-sm py-1.5" value={vals.quantita_consegnata}
                        onChange={e => set('quantita_consegnata', e.target.value)} placeholder="es. 30" />
                    </div>
                    <div>
                      <label className="label-xs">Data consegna</label>
                      <input type="date" className="input-base text-sm py-1.5" value={vals.data_consegna}
                        onChange={e => set('data_consegna', e.target.value)} />
                    </div>
                  </div>

                  {dataEsaurimento && (
                    <div className="rounded-md bg-amber/10 border border-amber/30 px-2.5 py-1.5 text-xs text-amber-700">
                      Scorta stimata esaurita il <strong>{dataEsaurimento}</strong>
                      {' '}· alert il giorno feriale precedente
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={vals.alert_esaurimento}
                      onChange={e => set('alert_esaurimento', e.target.checked)}
                      className="w-3.5 h-3.5 accent-forest" />
                    <span className="text-xs text-ink-soft">Attiva notifica automatica esaurimento scorta</span>
                  </label>
                </div>
              )}
            </div>

          </div>

          {error && (
            <p className="mx-3 mb-2 text-xs text-abx bg-abx/10 border border-abx/30 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Footer azioni */}
          <div className="flex gap-2 px-3 pb-3 pt-1">
            {dirty ? (
              <button type="button" onClick={resetForm} className="btn-ghost text-xs flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Annulla modifiche
              </button>
            ) : (
              <button type="button" onClick={onClose} className="btn-ghost text-xs">Chiudi</button>
            )}
            <button type="submit" disabled={isPending} className="btn-primary text-xs flex-1">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
