'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload, Camera, Loader2, X, MapPin } from 'lucide-react';
import { uploadDocumentoAction } from '@/app/(app)/[categoria]/actions';
import type { CategoriaArticolo } from '@/lib/types';
import { SALE } from '@/lib/sale';

const ACCEPT_FILE   = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp';
const ACCEPT_CAMERA = 'image/*';

export function UploadButton({
  categoria,
  orgId,
}: {
  categoria: CategoriaArticolo;
  orgId: string;
}) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isPending, startT]         = useTransition();
  const [pendingFile, setPendingF]  = useState<File | null>(null);
  const [salaId, setSalaId]         = useState<string>('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPendingF(file);
    setSalaId('');
  }

  function handleUpload() {
    if (!pendingFile) return;
    const fd = new FormData();
    fd.append('file', pendingFile);
    fd.append('org_id', orgId);
    fd.append('categoria', categoria);
    if (salaId) fd.append('sala', salaId);

    startT(async () => {
      const res = await uploadDocumentoAction(fd);
      if (res && 'error' in res) {
        setError(res.error ?? 'Errore sconosciuto.');
      } else {
        setPendingF(null);
        setSalaId('');
      }
      if (fileRef.current)   fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    });
  }

  function handleCancel() {
    setPendingF(null);
    setSalaId('');
    if (fileRef.current)   fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!pendingFile && !isPending && (
        <div className="flex gap-2">
          <button type="button" disabled={isPending} onClick={() => cameraRef.current?.click()} className="btn-secondary" title="Scatta o scegli foto">
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Foto</span>
          </button>
          <button type="button" disabled={isPending} onClick={() => fileRef.current?.click()} className="btn-primary" title="Carica PDF o immagine">
            <Upload className="w-4 h-4" />Carica
          </button>
        </div>
      )}

      {/* Pannello selezione sala */}
      {pendingFile && !isPending && (
        <div className="w-72 sm:w-80 rounded-xl border border-line bg-bg-card shadow-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{pendingFile.name}</p>
              <p className="text-xs text-ink-mute">{(pendingFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={handleCancel} className="text-ink-mute hover:text-abx shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>

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

          <button onClick={handleUpload} className="btn-primary w-full">
            <Upload className="w-4 h-4" /> Carica documento
          </button>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
        </div>
      )}

      {error && <p className="text-xs text-abx text-right">{error}</p>}

      <input ref={fileRef}   type="file" accept={ACCEPT_FILE}   className="hidden" onChange={handleChange} />
      <input ref={cameraRef} type="file" accept={ACCEPT_CAMERA} capture="environment" className="hidden" onChange={handleChange} />
    </div>
  );
}
