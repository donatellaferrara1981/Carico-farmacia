'use client';

import { useState, useTransition } from 'react';
import { FileText, Download, Trash2, Loader2 } from 'lucide-react';
import { deleteDocumentoAction, getDownloadUrlAction } from '@/app/(app)/[categoria]/actions';
import type { CategoriaArticolo } from '@/lib/types';

interface Documento {
  id: string;
  nome_file: string;
  storage_path: string;
  dimensione: number | null;
  created_at: string;
}

function formatBytes(b: number | null) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DocumentoRow({
  doc,
  canDelete,
  categoria,
}: {
  doc: Documento;
  canDelete: boolean;
  categoria: CategoriaArticolo;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      const res = await getDownloadUrlAction(doc.storage_path);
      if ('url' in res) {
        window.open(res.url, '_blank');
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Eliminare "${doc.nome_file}"?`)) return;
    startDelete(async () => {
      await deleteDocumentoAction(doc.id, doc.storage_path, categoria);
    });
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-bg-card border border-line rounded-xl">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-abx-soft flex items-center justify-center">
        <FileText className="w-5 h-5 text-abx" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{doc.nome_file}</p>
        <p className="text-xs text-ink-mute">
          {formatDate(doc.created_at)}
          {doc.dimensione ? ` · ${formatBytes(doc.dimensione)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          className="p-2 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-forest transition-colors"
          title="Scarica"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg hover:bg-abx-soft text-ink-soft hover:text-abx transition-colors"
            title="Elimina"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function DocumentiList({
  documenti,
  orgId,
  categoria,
  canDelete,
}: {
  documenti: Documento[];
  orgId: string;
  categoria: CategoriaArticolo;
  canDelete: boolean;
}) {
  if (documenti.length === 0) {
    return (
      <div className="text-center py-16 text-ink-mute">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nessun documento caricato.</p>
        {canDelete && (
          <p className="text-xs mt-1">Usa il pulsante "Carica PDF" per aggiungere file.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documenti.map((doc) => (
        <DocumentoRow key={doc.id} doc={doc} canDelete={canDelete} categoria={categoria} />
      ))}
    </div>
  );
}
