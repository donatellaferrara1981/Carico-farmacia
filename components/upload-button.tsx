'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload, Camera, Loader2 } from 'lucide-react';
import { uploadDocumentoAction } from '@/app/(app)/[categoria]/actions';
import type { CategoriaArticolo } from '@/lib/types';

const ACCEPT_FILE = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp';
const ACCEPT_CAMERA = 'image/*';

export function UploadButton({
  categoria,
  orgId,
}: {
  categoria: CategoriaArticolo;
  orgId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('org_id', orgId);
    fd.append('categoria', categoria);

    startTransition(async () => {
      const res = await uploadDocumentoAction(fd);
      if (res && 'error' in res) {
        setError(res.error ?? 'Errore sconosciuto.');
      }
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => cameraRef.current?.click()}
          className="btn-secondary"
          title="Scatta o scegli foto"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Foto</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileRef.current?.click()}
          className="btn-primary"
          title="Carica PDF o immagine"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Caricamento…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Carica
            </>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-abx text-right">{error}</p>}

      {/* selezione da file (PDF + immagini) */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_FILE}
        className="hidden"
        onChange={handleChange}
      />
      {/* fotocamera / rullino */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT_CAMERA}
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
