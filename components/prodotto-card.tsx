'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Plus, Minus, Upload, Camera, Loader2, FileText, ImageIcon, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { formaLabel, type ProdottoConDocumenti } from '@/lib/prodotti';
import { deleteProdottoAction, aggiornaQuantitaAction } from '@/app/(app)/[categoria]/prodotti-actions';
import { uploadDocumentoAction, deleteDocumentoAction, getDownloadUrlAction } from '@/app/(app)/[categoria]/actions';
import { ProdottoForm } from '@/components/prodotto-form';
import type { CategoriaArticolo } from '@/lib/types';

function isImage(nome: string) {
  return /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(nome);
}

function formatBytes(b: number | null) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  prodotto: ProdottoConDocumenti;
  categoria: CategoriaArticolo;
  canEdit: boolean;
}

export function ProdottoCard({ prodotto, categoria, canEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [isPendingDel, startDel] = useTransition();
  const [isPendingQ, startQ] = useTransition();
  const [isPendingUp, startUp] = useTransition();

  function handleDelete() {
    if (!confirm(`Eliminare "${prodotto.principio_attivo} ${prodotto.dosaggio ?? ''}"?`)) return;
    startDel(async () => {
      await deleteProdottoAction(prodotto.id, categoria);
    });
  }

  function handleQty(delta: number) {
    startQ(async () => {
      await aggiornaQuantitaAction(prodotto.id, delta, categoria);
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, source: 'file' | 'camera') {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('org_id', prodotto.org_id);
    fd.append('categoria', categoria);
    fd.append('prodotto_id', prodotto.id);
    startUp(async () => {
      await uploadDocumentoAction(fd);
    });
    e.target.value = '';
  }

  const qtyColor =
    prodotto.quantita === 0
      ? 'text-abx font-semibold'
      : prodotto.quantita <= 3
      ? 'text-amber font-semibold'
      : 'text-forest font-semibold';

  return (
    <>
      {editing && (
        <ProdottoForm
          orgId={prodotto.org_id}
          categoria={categoria}
          prodotto={prodotto}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="bg-bg-card border border-line rounded-xl overflow-hidden">
        {/* Header prodotto */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-forest-tint text-forest">
                  {formaLabel(prodotto.forma_farmaceutica)}
                </span>
                {prodotto.dosaggio && (
                  <span className="text-xs text-ink-mute">{prodotto.dosaggio}</span>
                )}
                {prodotto.consumo_giornaliero > 0 && (
                  <span className="text-xs text-ink-mute">· {prodotto.consumo_giornaliero}/die</span>
                )}
              </div>
              {prodotto.note && (
                <p className="text-xs text-ink-soft mt-1 leading-relaxed">{prodotto.note}</p>
              )}
            </div>

            {/* Quantità */}
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && (
                <button
                  onClick={() => handleQty(-1)}
                  disabled={isPendingQ || prodotto.quantita === 0}
                  className="w-7 h-7 rounded-lg border border-line flex items-center justify-center text-ink-soft hover:bg-bg-soft disabled:opacity-30"
                >
                  <Minus className="w-3 h-3" />
                </button>
              )}
              <span className={`text-sm min-w-[2rem] text-center tabular-nums ${qtyColor}`}>
                {isPendingQ ? <Loader2 className="w-3 h-3 animate-spin inline" /> : prodotto.quantita}
              </span>
              {canEdit && (
                <button
                  onClick={() => handleQty(1)}
                  disabled={isPendingQ}
                  className="w-7 h-7 rounded-lg border border-line flex items-center justify-center text-ink-soft hover:bg-bg-soft"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Azioni */}
        {canEdit && (
          <div className="px-4 pb-3 flex items-center gap-2 border-t border-line/50 pt-2">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors"
              title="Modifica"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isPendingDel}
              className="p-1.5 rounded-lg hover:bg-abx-soft text-ink-mute hover:text-abx transition-colors"
              title="Elimina"
            >
              {isPendingDel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1" />

            {/* Upload allegati */}
            <label className="cursor-pointer p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute hover:text-forest transition-colors" title="Scatta foto">
              {isPendingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, 'camera')} />
            </label>
            <label className="cursor-pointer p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute hover:text-forest transition-colors" title="Allega file">
              <Upload className="w-3.5 h-3.5" />
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
            </label>

            {prodotto.documenti.length > 0 && (
              <button
                onClick={() => setDocsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink px-2 py-1 rounded-lg hover:bg-bg-soft"
              >
                {prodotto.documenti.length} allegat{prodotto.documenti.length === 1 ? 'o' : 'i'}
                {docsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}

        {/* Lista allegati */}
        {docsOpen && prodotto.documenti.length > 0 && (
          <div className="border-t border-line/50 divide-y divide-line/50">
            {prodotto.documenti.map((doc) => (
              <DocRow key={doc.id} doc={doc} categoria={categoria} canDelete={canEdit} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DocRow({
  doc,
  categoria,
  canDelete,
}: {
  doc: ProdottoConDocumenti['documenti'][number];
  categoria: string;
  canDelete: boolean;
}) {
  const [isPending, start] = useTransition();
  const [isDeleting, startDel] = useTransition();

  function handleDownload() {
    start(async () => {
      const res = await getDownloadUrlAction(doc.storage_path);
      if ('url' in res) window.open(res.url, '_blank');
    });
  }

  function handleDelete() {
    if (!confirm(`Eliminare "${doc.nome_file}"?`)) return;
    startDel(async () => {
      await deleteDocumentoAction(doc.id, doc.storage_path, categoria);
    });
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="shrink-0">
        {isImage(doc.nome_file) ? (
          <ImageIcon className="w-4 h-4 text-ink-mute" />
        ) : (
          <FileText className="w-4 h-4 text-ink-mute" />
        )}
      </div>
      <p className="flex-1 text-xs text-ink truncate">{doc.nome_file}</p>
      <span className="text-xs text-ink-mute shrink-0">{formatBytes(doc.dimensione)}</span>
      <button onClick={handleDownload} disabled={isPending} className="p-1 text-ink-soft hover:text-forest">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </button>
      {canDelete && (
        <button onClick={handleDelete} disabled={isDeleting} className="p-1 text-ink-soft hover:text-abx">
          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
