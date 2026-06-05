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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExtracting, startExtract] = useTransition();
  const [extractResult, setExtractResult] = useState<{ ok?: boolean; count?: number; error?: string } | null>(null);

  const pdfDocs = documenti.filter((d) => !isImage(d.nome_file));
  const selectedDoc = pdfDocs.find((d) => d.id === selectedId) ?? null;

  function handleExtract() {
    if (!selectedDoc) return;
    setExtractResult(null);
    startExtract(async () => {
      const res = await estraiProdottiDaPdfAction(selectedDoc.id, selectedDoc.storage_path, orgId, categoria);
      setExtractResult(res);
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

      {/* Pannello estrazione — appare solo se ci sono PDF */}
      {canDelete && pdfDocs.length > 0 && (
        <div className="bg-forest-tint border border-forest/20 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-forest flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Estrai prodotti con AI
          </p>
          <p className="text-xs text-ink-soft">Seleziona il PDF da analizzare, poi premi Estrai.</p>

          <div className="flex flex-col gap-2">
            {pdfDocs.map((doc) => (
              <label
                key={doc.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === doc.id
                    ? 'border-forest bg-forest/5'
                    : 'border-line bg-bg-card hover:border-forest/40'
                }`}
              >
                <input
                  type="radio"
                  name="doc-select"
                  value={doc.id}
                  checked={selectedId === doc.id}
                  onChange={() => { setSelectedId(doc.id); setExtractResult(null); }}
                  className="accent-forest"
                />
                <span className="text-sm text-ink truncate">{doc.nome_file}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExtract}
              disabled={!selectedId || isExtracting}
              className="btn-primary py-2"
            >
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Estrai</>
              )}
            </button>
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
