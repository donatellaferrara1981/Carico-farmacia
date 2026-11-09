'use client';

import { useRef, useState, useTransition } from 'react';
import { Archive, Eye, Printer, Trash2, Loader2, X, AlertCircle } from 'lucide-react';
import {
  getRelazioneHtmlAction,
  eliminaRelazioniAction,
  type TipoRelazione,
} from '@/app/(app)/relazioni/actions';

export interface RelazioneArchiviata {
  id: string;
  titolo: string;
  periodo: string | null;
  created_at: string;
  created_by_nome: string | null;
  tipo?: string;
}

function formatData(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ArchivioRelazioni({
  tipo,
  relazioni,
}: {
  tipo?: TipoRelazione;
  relazioni: RelazioneArchiviata[];
}) {
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set());
  const [errore, setErrore] = useState<string | null>(null);
  const [eliminando, startElimina] = useTransition();
  const [apertura, startApertura] = useTransition();
  const [apertaId, setApertaId] = useState<string | null>(null);
  const [aperta, setAperta] = useState<{ titolo: string; html: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Tiene solo le selezioni ancora presenti (dopo un'eliminazione la lista si aggiorna)
  const idsPresenti = new Set(relazioni.map((r) => r.id));
  const selezioniValide = [...selezionate].filter((id) => idsPresenti.has(id));
  const tutteSelezionate = relazioni.length > 0 && selezioniValide.length === relazioni.length;

  function toggle(id: string) {
    setSelezionate((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTutte() {
    setSelezionate(tutteSelezionate ? new Set() : new Set(relazioni.map((r) => r.id)));
  }

  function apri(r: RelazioneArchiviata) {
    setErrore(null);
    setApertaId(r.id);
    startApertura(async () => {
      const res = await getRelazioneHtmlAction(r.id);
      if ('html' in res && res.html) {
        setAperta({ titolo: r.titolo, html: res.html });
      } else {
        setErrore('error' in res && res.error ? res.error : 'Impossibile aprire la relazione.');
      }
      setApertaId(null);
    });
  }

  function eliminaSelezionate() {
    const ids = selezioniValide;
    if (!ids.length) return;
    if (!confirm(`Eliminare definitivamente ${ids.length} relazion${ids.length === 1 ? 'e' : 'i'} dall'archivio? L'operazione non è reversibile.`)) return;
    setErrore(null);
    startElimina(async () => {
      const res = await eliminaRelazioniAction(ids, tipo);
      if ('error' in res && res.error) {
        setErrore(res.error);
        return;
      }
      setSelezionate(new Set());
    });
  }

  function stampaAperta() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Archive className="w-4 h-4 text-forest" />
          Relazioni archiviate ({relazioni.length})
        </h2>
        {relazioni.length > 0 && (
          <div className="flex items-center gap-3 ml-auto">
            <button type="button" onClick={toggleTutte} className="text-xs text-forest underline">
              {tutteSelezionate ? 'Deseleziona tutte' : 'Seleziona tutte'}
            </button>
            <button
              type="button"
              onClick={eliminaSelezionate}
              disabled={selezioniValide.length === 0 || eliminando}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-abx/40 text-abx hover:bg-abx-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Elimina{selezioniValide.length > 0 ? ` (${selezioniValide.length})` : ' selezionate'}
            </button>
          </div>
        )}
      </div>

      {errore && (
        <p className="flex items-center gap-1 text-xs text-abx">
          <AlertCircle className="w-3.5 h-3.5" /> {errore}
        </p>
      )}

      {relazioni.length === 0 ? (
        <p className="text-sm text-ink-mute text-center py-6">
          Nessuna relazione archiviata. Usa il pulsante «Archivia» dopo aver generato la relazione.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {relazioni.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selezionate.has(r.id) ? 'border-forest bg-forest/5' : 'border-line bg-bg-card'
              }`}
            >
              <input
                type="checkbox"
                checked={selezionate.has(r.id)}
                onChange={() => toggle(r.id)}
                className="accent-forest w-4 h-4 shrink-0"
                aria-label={`Seleziona ${r.titolo}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {r.tipo && !tipo && (
                    <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded-full bg-forest/10 text-forest border border-forest/20 uppercase align-middle">
                      {r.tipo === 'altro' ? 'altra' : r.tipo}
                    </span>
                  )}
                  {r.titolo}
                </p>
                <p className="text-xs text-ink-mute">
                  Archiviata il {formatData(r.created_at)}
                  {r.created_by_nome ? ` · ${r.created_by_nome}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => apri(r)}
                disabled={apertura}
                className="p-2 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-forest transition-colors shrink-0"
                title="Apri"
              >
                {apertaId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {aperta && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3"
          onClick={() => setAperta(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
              <p className="text-sm font-semibold text-ink truncate flex-1">{aperta.titolo}</p>
              <button
                type="button"
                onClick={stampaAperta}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line hover:border-forest/40 text-ink-soft hover:text-forest transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Stampa
              </button>
              <button
                type="button"
                onClick={() => setAperta(null)}
                className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-soft"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* sandbox senza allow-scripts: eventuale codice nel contenuto non viene eseguito */}
            <iframe
              ref={iframeRef}
              title={aperta.titolo}
              srcDoc={aperta.html}
              sandbox="allow-same-origin allow-modals"
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
