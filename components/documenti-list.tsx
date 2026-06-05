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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExtracting, startExtract] = useTransition();
  const [extractResult, setExtractResult] = useState<{ ok?: boolean; count?: number; error?: string; current?: string } | null>(null);

  const pdfDocs = documenti.filter((d) => !isImage(d.nome_file));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setExtractResult(null);
  }

  function toggleAll() {
    if (selectedIds.size === pdfDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pdfDocs.map((d) => d.id)));
    }
    setExtractResult(null);
  }

  function handleExtract() {
    const selezionati = pdfDocs.filter((d) => selectedIds.has(d.id));
    if (!selezionati.length) return;
    setExtractResult(null);
    startExtract(async () => {
      let totale = 0;
      for (const doc of selezionati) {
        setExtractResult({ current: doc.nome_file });
        const res = await estraiProdottiDaPdfAction(doc.id, doc.storage_path, orgId, categoria);
        if ('error' in res) {
          setExtractResult({ error: `${doc.nome_file}: ${res.error}` });
          return;
        }
        totale += res.count ?? 0;
      }
      setExtractResult({ ok: true, count: totale });
    });
  }

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
    <div className="flex flex-col gap-3">

      {/* Pannello estrazione */}
      {canDelete && pdfDocs.length > 0 && (
        <div className="bg-forest-tint border border-forest/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-forest flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Estrai prodotti automaticamente
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-forest underline"
            >
              {selectedIds.size === pdfDocs.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
          </div>
          <p className="text-xs text-ink-soft">Spunta uno o più PDF, poi premi Estrai.</p>

          <div className="flex flex-col gap-2">
            {pdfDocs.map((doc) => (
              <label
                key={doc.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedIds.has(doc.id)
                    ? 'border-forest bg-forest/5'
                    : 'border-line bg-bg-card hover:border-forest/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(doc.id)}
                  onChange={() => toggleSelect(doc.id)}
                  className="accent-forest w-4 h-4"
                />
                <span className="text-sm text-ink truncate">{doc.nome_file}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExtract}
              disabled={selectedIds.size === 0 || isExtracting}
              className="btn-primary py-2"
            >
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Estrai{selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}</>
              )}
            </button>
            {extractResult && 'current' in extractResult && (
              <span className="text-xs text-forest animate-pulse truncate max-w-[200px]">
                ⏳ {extractResult.current}
              </span>
            )}
            {extractResult && 'ok' in extractResult && (
              <span className="flex items-center gap-1 text-sm text-forest font-medium">
                <CheckCircle2 className="w-4 h-4" />
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
        </div>
      )}

      {/* Lista documenti */}
      {documenti.map((doc) => (
        <DocRow key={doc.id} doc={doc} canDelete={canDelete} categoria={categoria} />
      ))}
    </div>
  );
}

function DocRow({
  doc,
  canDelete,
  categoria,
}: {
  doc: Documento;
  canDelete: boolean;
  categoria: CategoriaArticolo;
}) {
  const [isPending, startDownload] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleDownload() {
    startDownload(async () => {
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

  return (
    <div className="flex items-center gap-3 p-4 bg-bg-card border border-line rounded-xl">
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
  );
}
