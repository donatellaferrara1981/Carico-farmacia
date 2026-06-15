'use client';

import { useState, useTransition } from 'react';
import { ArrowUpDown, Pencil, Check, X, Loader2 } from 'lucide-react';
import { aggiornaOrdineSanitarioAction } from '@/app/(app)/[categoria]/prodotti-actions';
import { ProdottoForm } from '@/components/prodotto-form';
import type { ProdottoConDocumenti } from '@/lib/prodotti';

type Ordine = 'alfa' | 'consumo';

function RigaArticolo({ p }: { p: ProdottoConDocumenti }) {
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPending, start] = useTransition();

  const qSettimana = Number(p.consumo_giornaliero ?? 0);
  const qScorsa    = p.quantita_consegnata ?? null;
  const media      = p.consumo_medio != null ? Number(p.consumo_medio) : null;

  function openQty() {
    setDraft(qSettimana > 0 ? String(qSettimana) : '');
    setEditQty(true);
  }

  function saveQty() {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < 0) { setEditQty(false); return; }
    start(async () => {
      await aggiornaOrdineSanitarioAction(p.id, n);
      setEditQty(false);
    });
  }

  return (
    <>
      {editing && (
        <ProdottoForm
          orgId={p.org_id}
          categoria="sanitario"
          prodotto={p}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line last:border-0 hover:bg-bg-soft/60 group">
        {/* Nome + codice */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink leading-snug truncate">{p.principio_attivo}</p>
          {p.nome_commerciale && (
            <p className="text-[10px] text-ink-mute truncate">{p.nome_commerciale}</p>
          )}
        </div>

        {/* Media consumo */}
        {media != null && (
          <div className="text-center shrink-0 w-10">
            <p className="text-[10px] text-ink-mute leading-none">media</p>
            <p className="text-xs font-semibold text-ink-soft">{media}</p>
          </div>
        )}

        {/* Sett. scorsa (dimmed) */}
        <div className="text-center shrink-0 w-10">
          {qScorsa != null ? (
            <>
              <p className="text-[10px] text-ink-mute leading-none">scorsa</p>
              <p className="text-xs text-ink-mute/60 font-medium">{qScorsa}</p>
            </>
          ) : (
            <p className="text-[10px] text-ink-mute/40">—</p>
          )}
        </div>

        {/* Ordine questa settimana — cliccabile */}
        <div className="shrink-0 w-16">
          {editQty ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                min={0}
                className="w-10 text-xs text-center border border-forest rounded px-1 py-0.5 bg-bg outline-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveQty(); if (e.key === 'Escape') setEditQty(false); }}
              />
              {isPending
                ? <Loader2 className="w-3 h-3 animate-spin text-forest" />
                : <>
                    <button onClick={saveQty} className="text-forest hover:text-forest-dark"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditQty(false)} className="text-ink-mute hover:text-ink"><X className="w-3 h-3" /></button>
                  </>
              }
            </div>
          ) : (
            <button
              onClick={openQty}
              className="w-full text-right flex flex-col items-end"
            >
              <span className="text-[10px] text-ink-mute leading-none">questa sett.</span>
              <span className={`text-sm font-bold ${qSettimana > 0 ? 'text-forest' : 'text-ink-mute/40'}`}>
                {qSettimana > 0 ? qSettimana : '—'}
              </span>
            </button>
          )}
        </div>

        {/* Edit prodotto */}
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-bg text-ink-mute hover:text-ink transition-all shrink-0"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}

export function SanitarioView({ prodotti }: { prodotti: ProdottoConDocumenti[] }) {
  const [ordine, setOrdine] = useState<Ordine>('alfa');

  const ordinati = [...prodotti].sort((a, b) => {
    if (ordine === 'alfa') return a.principio_attivo.localeCompare(b.principio_attivo, 'it');
    // consumo: media se disponibile, altrimenti consumo_giornaliero
    const ca = Number(a.consumo_medio ?? a.consumo_giornaliero ?? 0);
    const cb = Number(b.consumo_medio ?? b.consumo_giornaliero ?? 0);
    return cb - ca;
  });

  if (prodotti.length === 0) return null;

  return (
    <div className="rounded-xl border border-line bg-bg-card overflow-hidden">
      {/* Header filtri */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-bg-soft">
        <ArrowUpDown className="w-3.5 h-3.5 text-ink-mute" />
        <span className="text-xs text-ink-mute mr-1">Ordina:</span>
        <button
          onClick={() => setOrdine('alfa')}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            ordine === 'alfa' ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
          }`}
        >
          A→Z
        </button>
        <button
          onClick={() => setOrdine('consumo')}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            ordine === 'consumo' ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
          }`}
        >
          Per consumo
        </button>
        <span className="ml-auto text-[10px] text-ink-mute">{prodotti.length} articoli</span>
      </div>

      {/* Intestazione colonne */}
      <div className="flex items-center gap-2 px-3 py-1 bg-bg-soft/50 border-b border-line">
        <p className="flex-1 text-[10px] text-ink-mute font-medium uppercase tracking-wide">Articolo</p>
        <p className="w-10 text-[10px] text-ink-mute text-center">Media</p>
        <p className="w-10 text-[10px] text-ink-mute text-center">Scorsa</p>
        <p className="w-16 text-[10px] text-ink-mute text-right">Questa sett.</p>
        <div className="w-5" />
      </div>

      {/* Righe */}
      {ordinati.map((p) => <RigaArticolo key={p.id} p={p} />)}
    </div>
  );
}
