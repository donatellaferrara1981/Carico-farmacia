'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload, Camera, Loader2, X, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadDocumentoAction } from '@/app/(app)/[categoria]/actions';
import type { CategoriaArticolo } from '@/lib/types';
import { SALE } from '@/lib/sale';

const ACCEPT_FILE   = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp';
const ACCEPT_CAMERA = 'image/*';

interface FileItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadButton({
  categoria,
  orgId,
}: {
  categoria: CategoriaArticolo;
  orgId: string;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue]   = useState<FileItem[]>([]);
  const [salaId, setSalaId] = useState<string>('');
  const [isPending, startT] = useTransition();

  // Sanitario non usa le sale
  const useSala = categoria !== 'sanitario';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setQueue(files.map((f) => ({ file: f, status: 'pending' })));
    setSalaId('');
  }

  function handleCancel() {
    setQueue([]);
    setSalaId('');
    if (fileRef.current)   fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  async function handleUpload() {
    startT(async () => {
      const updated: FileItem[] = [...queue];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].status === 'done') continue;
        updated[i] = { ...updated[i], status: 'uploading' };
        setQueue([...updated]);

        const fd = new FormData();
        fd.append('file', updated[i].file);
        fd.append('org_id', orgId);
        fd.append('categoria', categoria);
        if (useSala && salaId) fd.append('sala', salaId);

        const res = await uploadDocumentoAction(fd);
        if (res && 'error' in res) {
          updated[i] = { ...updated[i], status: 'error', error: res.error ?? 'Errore' };
        } else {
          updated[i] = { ...updated[i], status: 'done' };
        }
        setQueue([...updated]);
      }

      // Auto-chiudi dopo 2s se tutti ok
      const allOk = updated.every((f) => f.status === 'done');
      if (allOk) {
        setTimeout(() => {
          setQueue([]);
          if (fileRef.current)   fileRef.current.value = '';
          if (cameraRef.current) cameraRef.current.value = '';
        }, 1500);
      }
    });
  }

  const allDone    = queue.length > 0 && queue.every((f) => f.status === 'done');
  const hasErrors  = queue.some((f) => f.status === 'error');
  const isRunning  = isPending || queue.some((f) => f.status === 'uploading');

  return (
    <div className="flex flex-col items-end gap-1">
      {queue.length === 0 && !isPending && (
        <div className="flex gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary" title="Scatta o scegli foto">
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Foto</span>
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary" title="Carica PDF o immagini">
            <Upload className="w-4 h-4" />Carica
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="w-72 sm:w-80 rounded-xl border border-line bg-bg-card shadow-lg p-4 space-y-3">
          {/* Lista file */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {queue.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {item.status === 'done'      && <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />}
                {item.status === 'error'     && <AlertCircle  className="w-4 h-4 text-abx shrink-0" />}
                {item.status === 'uploading' && <Loader2      className="w-4 h-4 animate-spin text-ink-mute shrink-0" />}
                {item.status === 'pending'   && <div className="w-4 h-4 rounded-full border-2 border-line shrink-0" />}
                <span className={`flex-1 truncate ${item.status === 'done' ? 'text-ink-mute' : 'text-ink'}`}>
                  {item.file.name}
                </span>
                {item.error && <span className="text-abx truncate max-w-[100px]">{item.error}</span>}
              </div>
            ))}
          </div>

          <p className="text-xs text-ink-mute">{queue.length} file selezionat{queue.length === 1 ? 'o' : 'i'}</p>

          {/* Selezione sala — solo per categorie non sanitario */}
          {useSala && !isRunning && !allDone && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft mb-2">
                <MapPin className="w-3.5 h-3.5" /> A quale sala appartiene?
              </p>
              <div className="space-y-1.5">
                {SALE.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSalaId(s.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                      salaId === s.id ? 'border-forest bg-forest text-white' : 'border-line hover:border-forest/40 text-ink'
                    }`}
                  >
                    <span>{s.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${salaId === s.id ? 'bg-white/20 text-white border-white/30' : s.colore}`}>
                      {s.giornoRifornimento}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSalaId('')}
                  className={`w-full px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                    salaId === '' ? 'border-forest bg-forest text-white' : 'border-line hover:border-forest/40 text-ink-soft'
                  }`}
                >
                  Documento generale (nessuna sala)
                </button>
              </div>
            </div>
          )}

          {/* Azioni */}
          {!allDone && (
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={isRunning} className="btn-secondary flex-1">
                <X className="w-4 h-4" /> Annulla
              </button>
              <button onClick={handleUpload} disabled={isRunning} className="btn-primary flex-1">
                {isRunning
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Caricamento…</>
                  : <><Upload className="w-4 h-4" /> Carica tutti</>}
              </button>
            </div>
          )}

          {allDone && (
            <div className="flex items-center gap-2 text-sm text-forest font-medium">
              <CheckCircle2 className="w-4 h-4" /> Tutti i file caricati
            </div>
          )}

          {hasErrors && !isRunning && (
            <button onClick={handleUpload} className="btn-primary w-full text-sm">
              <Upload className="w-4 h-4" /> Riprova errori
            </button>
          )}
        </div>
      )}

      <input ref={fileRef}   type="file" accept={ACCEPT_FILE}   multiple className="hidden" onChange={handleChange} />
      <input ref={cameraRef} type="file" accept={ACCEPT_CAMERA} multiple capture="environment" className="hidden" onChange={handleChange} />
    </div>
  );
}
