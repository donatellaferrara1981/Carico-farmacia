'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { uploadDocumentoAction } from '@/app/(app)/[categoria]/actions';
import type { CategoriaArticolo } from '@/lib/types';

export function UploadButton({
  categoria,
  orgId,
}: {
  categoria: CategoriaArticolo;
  orgId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="btn-primary"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Caricamento…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Carica PDF
          </>
        )}
      </button>
      {error && <p className="text-xs text-abx">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
