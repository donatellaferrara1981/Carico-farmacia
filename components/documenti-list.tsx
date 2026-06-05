'use client';

import { useState, useTransition } from 'react';
import { FileText, ImageIcon, Download, Trash2, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { deleteDocumentoAction, getDownloadUrlAction } from '@/app/(app)/[categoria]/actions';
import { estraiProdottiDaPdfAction } from '@/app/(app)/[categoria]/estrai-actions';
import type { CategoriaArticolo } from '@/lib/types';

interface Documento {
  id: string;
  nome_file: string;
  storage_path: string;
  dimensione: number | null;
  created_at: string;
}

function isImage(nome: string) {
  return /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(nome);
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
  orgId,
}: {
  doc: Documento;
  canDelete: boolean;
  categoria: CategoriaArticolo;
  orgId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isExtracting, startExtract] = useTransition();
  const [extractResult, setExtractResult] = useState<{ ok?: boolean; count?: number; error?: string } | null>(null);

  function handleDownload() {
    startTransition(async () => {
      const res = await getDownloadUrlAction(doc.storage_path);
      if ('url' in res) window.open(res.url, '_blank');
    });
  }

  function handleDelete() {
    if (!confirm(`Eliminare "${doc.nome_file}"?`)) return;
    startDelete(async () => {
      await deleteDocumentoAction(doc.id, doc.storage_path, categoria);
    });
  }

  function handleExtract() {
    setExtractResult(null);
    startExtract(async () => {
      const res = await estraiProdottiDaPdfAction(doc.id, doc.storage_path, orgId, categoria);
      setExtractResult(res);
    });
  }

  const isPdf = !isImage(doc.nome_file);

  return (
    <div className="bg-bg-card border border-line rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-abx-soft flex items-center justify-center">
          {isImage(doc.nome_file) ? (
            <ImageIcon className="w-5 h-5 text-abx" />
          ) : (
            <FileText className="w-5 h-5 text-abx" />
          )}
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
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-lg hover:bg-abx-soft text-ink-soft hover:text-abx transition-colors"
              title="Elimina"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Pulsante estrai — solo per PDF */}
      {isPdf && canDelete && (
        <div className="px-4 pb-3 border-t border-line/50 pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting}
            className="flex items-center gap-2 text-sm font-medium text-forest hover:text-forest-soft transition-colors disabled:opacity-60"
          >
            {isExtracting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Estrai prodotti con AI</>
            )}
          </button>
          {extractResult && 'ok' in extractResult && (
            <span className="flex items-center gap-1 text-xs text-forest">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {extractResult.count} prodott{extractResult.count === 1 ? 'o' : 'i'} aggiunti
            </span>
          )}
          {extractResult && 'error' in extractResult && (
            <span className="flex items-center gap-1 text-xs text-abx">
              <AlertCircle className="w-3.5 h-3.5" />
              {extractResult.error}
            </span>
          )}
        </div>
      )}
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
          <p className="text-xs mt-1">Usa i pulsanti in alto per caricare PDF, foto o immagini.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documenti.map((doc) => (
        <DocumentoRow key={doc.id} doc={doc} canDelete={canDelete} categoria={categoria} orgId={orgId} />
      ))}
    </div>
  );
}
