'use client';

import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { raggruppaPer, type ProdottoConDocumenti } from '@/lib/prodotti';
import { ProdottoCard } from '@/components/prodotto-card';
import { ProdottoForm } from '@/components/prodotto-form';
import { DocumentiList } from '@/components/documenti-list';
import { UploadButton } from '@/components/upload-button';
import type { CategoriaArticolo } from '@/lib/types';

interface DocLibero {
  id: string;
  nome_file: string;
  storage_path: string;
  dimensione: number | null;
  created_at: string;
}

interface Props {
  prodotti: ProdottoConDocumenti[];
  docsLiberi: DocLibero[];
  orgId: string;
  categoria: CategoriaArticolo;
  canEdit: boolean;
}

export function ProdottiView({ prodotti, docsLiberi, orgId, categoria, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const gruppi = raggruppaPer(prodotti);

  return (
    <div className="space-y-6">
      {/* Pulsante aggiungi prodotto */}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nuovo prodotto
          </button>
        </div>
      )}

      {showForm && (
        <ProdottoForm
          orgId={orgId}
          categoria={categoria}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Prodotti raggruppati per principio attivo */}
      {gruppi.size === 0 && docsLiberi.length === 0 && (
        <div className="text-center py-16 text-ink-mute">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessun prodotto ancora.</p>
          {canEdit && <p className="text-xs mt-1">Clicca "Nuovo prodotto" per iniziare.</p>}
        </div>
      )}

      {[...gruppi.entries()].map(([principio, items]) => (
        <div key={principio}>
          {/* Intestazione principio attivo */}
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-lg font-semibold text-ink capitalize">{principio}</h2>
            <span className="text-xs text-ink-mute bg-bg-soft px-2 py-0.5 rounded-full">
              {items.length} {items.length === 1 ? 'forma' : 'forme'}
            </span>
          </div>

          <div className="space-y-2">
            {items.map((p) => (
              <ProdottoCard key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} />
            ))}
          </div>
        </div>
      ))}

      {/* Documenti liberi (non collegati a prodotti) */}
      {(docsLiberi.length > 0 || canEdit) && (
        <div className="border-t border-line pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-soft text-sm">Altri documenti</h2>
            {canEdit && <UploadButton categoria={categoria} orgId={orgId} />}
          </div>
          <DocumentiList
            documenti={docsLiberi}
            orgId={orgId}
            categoria={categoria}
            canDelete={canEdit}
          />
        </div>
      )}
    </div>
  );
}
