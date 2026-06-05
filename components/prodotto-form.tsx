'use client';

import { useState, useTransition } from 'react';
import { X, Loader2 } from 'lucide-react';
import { FORME_FARMACEUTICHE, type FormaFarmaceutica, type Prodotto } from '@/lib/prodotti';
import { upsertProdottoAction } from '@/app/(app)/[categoria]/prodotti-actions';
import type { CategoriaArticolo } from '@/lib/types';

interface Props {
  orgId: string;
  categoria: CategoriaArticolo;
  prodotto?: Prodotto;
  onClose: () => void;
}

export function ProdottoForm({ orgId, categoria, prodotto, onClose }: Props) {
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    const principio_attivo = String(fd.get('principio_attivo') ?? '').trim();
    if (!principio_attivo) { setError('Inserisci il principio attivo.'); return; }

    start(async () => {
      const soglia = parseInt(String(fd.get('soglia_minima') ?? ''), 10);
      const res = await upsertProdottoAction(
        orgId,
        categoria,
        {
          principio_attivo,
          nome_commerciale: String(fd.get('nome_commerciale') ?? ''),
          forma_farmaceutica: String(fd.get('forma_farmaceutica')) as FormaFarmaceutica,
          dosaggio: String(fd.get('dosaggio') ?? ''),
          quantita: Math.max(0, parseInt(String(fd.get('quantita') ?? '0'), 10) || 0),
          consumo_giornaliero: Math.max(0, parseFloat(String(fd.get('consumo_giornaliero') ?? '0')) || 0),
          soglia_minima: isNaN(soglia) ? null : Math.max(0, soglia),
          data_scadenza: String(fd.get('data_scadenza') ?? ''),
          note: String(fd.get('note') ?? ''),
        },
        prodotto?.id,
      );
      if (res && 'error' in res) { setError(res.error ?? 'Errore.'); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-bg-card rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-line">
          <h2 className="font-semibold text-ink">
            {prodotto ? 'Modifica prodotto' : 'Nuovo prodotto'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-soft text-ink-soft">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label-base">Principio attivo *</label>
            <input
              name="principio_attivo"
              className="input-base"
              defaultValue={prodotto?.principio_attivo ?? ''}
              placeholder="es. Paracetamolo"
              required
            />
          </div>

          <div>
            <label className="label-base">Nome commerciale</label>
            <input
              name="nome_commerciale"
              className="input-base"
              defaultValue={prodotto?.nome_commerciale ?? ''}
              placeholder="es. Tachipirina, Lyrica…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Forma farmaceutica *</label>
              <select
                name="forma_farmaceutica"
                className="input-base"
                defaultValue={prodotto?.forma_farmaceutica ?? 'compressa'}
              >
                {FORME_FARMACEUTICHE.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-base">Dosaggio</label>
              <input
                name="dosaggio"
                className="input-base"
                defaultValue={prodotto?.dosaggio ?? ''}
                placeholder="es. 500 mg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Quantità in scorta</label>
              <input
                name="quantita"
                type="number"
                min={0}
                className="input-base"
                defaultValue={prodotto?.quantita ?? 0}
              />
            </div>
            <div>
              <label className="label-base">Consumo/die</label>
              <input
                name="consumo_giornaliero"
                type="number"
                min={0}
                step="0.5"
                className="input-base"
                defaultValue={prodotto?.consumo_giornaliero ?? 0}
                placeholder="pz al giorno"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Soglia minima alert</label>
              <input
                name="soglia_minima"
                type="number"
                min={0}
                className="input-base"
                defaultValue={prodotto?.soglia_minima ?? ''}
                placeholder="es. 5"
              />
            </div>
            <div>
              <label className="label-base">Data scadenza</label>
              <input
                name="data_scadenza"
                type="date"
                className="input-base"
                defaultValue={prodotto?.data_scadenza ?? ''}
              />
            </div>
          </div>

          <div>
            <label className="label-base">Note</label>
            <textarea
              name="note"
              rows={2}
              className="input-base resize-none"
              defaultValue={prodotto?.note ?? ''}
              placeholder="es. Soluzione fisiologica 0.9%, Ringer lattato…"
            />
          </div>

          {error && (
            <p className="text-sm text-abx bg-abx-soft border border-abx/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Annulla
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
