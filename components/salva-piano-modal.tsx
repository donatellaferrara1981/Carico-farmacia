'use client';

import { useState, useTransition } from 'react';
import { X, Loader2, Save, Calendar } from 'lucide-react';
import { salvaPianoAction, type RigaPiano } from '@/app/(app)/[categoria]/piani-actions';
import type { CategoriaArticolo } from '@/lib/types';

interface Props {
  orgId: string;
  categoria: CategoriaArticolo;
  giorni: number;
  righe: RigaPiano[];
  onClose: () => void;
}

export function SalvaPianoModal({ orgId, categoria, giorni, righe, onClose }: Props) {
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const oggi = new Date().toISOString().split('T')[0];
  const fine = new Date(Date.now() + giorni * 86400000).toISOString().split('T')[0];

  const [titolo, setTitolo] = useState(`Piano ${categoria} — ${giorni} giorni`);
  const [dataInizio, setDataInizio] = useState(oggi);
  const [dataFine, setDataFine] = useState(fine);
  const [note, setNote] = useState('');

  function handleSave() {
    if (!titolo.trim()) { setError('Inserisci un titolo.'); return; }
    setError(null);
    start(async () => {
      const res = await salvaPianoAction(orgId, categoria, {
        titolo: titolo.trim(),
        data_inizio: dataInizio,
        data_fine: dataFine,
        giorni,
        note: note.trim(),
        righe,
      });
      if (res && 'error' in res) { setError(res.error ?? 'Errore'); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-bg-card rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-line">
          <h2 className="font-semibold text-ink flex items-center gap-2">
            <Calendar className="w-4 h-4 text-forest" /> Salva piano fabbisogno
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-soft text-ink-soft">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label-base">Titolo</label>
            <input
              className="input-base"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="es. Piano terapie maggio"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Data inizio</label>
              <input
                type="date"
                className="input-base"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
              />
            </div>
            <div>
              <label className="label-base">Data fine</label>
              <input
                type="date"
                className="input-base"
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-base">Note (opzionale)</label>
            <textarea
              rows={2}
              className="input-base resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. Turno notte, reparto Spinale..."
            />
          </div>

          <div className="bg-bg-soft rounded-xl p-3 border border-line">
            <p className="text-xs font-medium text-ink-soft mb-2">
              {righe.length} farmaci inclusi · {giorni} giorni
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {righe.slice(0, 5).map((r, i) => (
                <div key={i} className="flex justify-between text-xs text-ink-mute">
                  <span>{r.principio_attivo}{r.dosaggio ? ` ${r.dosaggio}` : ''}</span>
                  <span className="font-medium text-forest">× {r.fabbisogno}</span>
                </div>
              ))}
              {righe.length > 5 && (
                <p className="text-xs text-ink-mute">... e altri {righe.length - 5}</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-abx bg-abx/5 border border-abx/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Annulla</button>
            <button onClick={handleSave} disabled={isPending} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salva nel calendario</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
