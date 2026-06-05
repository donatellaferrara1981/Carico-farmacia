'use client';

import { useState, useTransition } from 'react';
import { Plus, FileText, Pencil, Trash2, Minus, Plus as PlusIcon, Loader2, Tag } from 'lucide-react';
import { formaLabel, type ProdottoConDocumenti } from '@/lib/prodotti';
import { ProdottoForm } from '@/components/prodotto-form';
import { DocumentiList } from '@/components/documenti-list';
import { UploadButton } from '@/components/upload-button';
import { deleteProdottoAction, aggiornaQuantitaAction, toggleNominativaAction } from '@/app/(app)/[categoria]/prodotti-actions';
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

function RigaProdotto({ prodotto, categoria, canEdit, giorni }: {
  prodotto: ProdottoConDocumenti;
  categoria: CategoriaArticolo;
  canEdit: boolean;
  giorni: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isPendingDel, startDel] = useTransition();
  const [isPendingQ, startQ] = useTransition();
  const [isPendingN, startN] = useTransition();

  const fabbisogno = Math.ceil((prodotto.consumo_giornaliero ?? 1) * giorni);

  const qtyColor =
    prodotto.quantita === 0 ? 'text-abx font-bold' :
    prodotto.quantita <= 3 ? 'text-amber font-bold' :
    'text-forest font-bold';

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
      <tr className="border-b border-line/50 hover:bg-bg-soft/40 transition-colors">
        {/* Farmaco */}
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-ink leading-tight">
                {prodotto.principio_attivo}
              </span>
              {prodotto.nome_commerciale && (
                <span className="text-xs text-ink-mute italic">· {prodotto.nome_commerciale}</span>
              )}
              {prodotto.nominativa && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber/20 text-amber font-medium border border-amber/40">
                  nominativa
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-forest-tint text-forest font-medium">
                {formaLabel(prodotto.forma_farmaceutica)}
              </span>
              {prodotto.dosaggio && (
                <span className="text-xs text-ink-mute">{prodotto.dosaggio}</span>
              )}
            </div>
          </div>
        </td>

        {/* Consumo/die */}
        <td className="px-3 py-2.5 text-center tabular-nums">
          <span className="text-sm font-semibold text-ink">{prodotto.consumo_giornaliero ?? 1}</span>
          <span className="text-xs text-ink-mute">/die</span>
        </td>

        {/* Fabbisogno per N giorni */}
        <td className="px-3 py-2.5 text-center tabular-nums">
          <span className="text-sm font-semibold text-forest">{fabbisogno}</span>
        </td>

        {/* Scorte */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 justify-center">
            {canEdit && (
              <button
                onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, -1, categoria); })}
                disabled={isPendingQ || prodotto.quantita === 0}
                className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft disabled:opacity-30"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}
            <span className={`text-sm min-w-[1.5rem] text-center tabular-nums ${qtyColor}`}>
              {isPendingQ ? <Loader2 className="w-3 h-3 animate-spin inline" /> : prodotto.quantita}
            </span>
            {canEdit && (
              <button
                onClick={() => startQ(async () => { await aggiornaQuantitaAction(prodotto.id, 1, categoria); })}
                disabled={isPendingQ}
                className="w-6 h-6 rounded border border-line flex items-center justify-center text-ink-mute hover:bg-bg-soft"
              >
                <PlusIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </td>

        {/* Azioni */}
        {canEdit && (
          <td className="px-2 py-2.5">
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => startN(async () => { await toggleNominativaAction(prodotto.id, !prodotto.nominativa, categoria); })}
                disabled={isPendingN}
                className={`p-1.5 rounded transition-colors ${prodotto.nominativa ? 'text-amber bg-amber/10' : 'text-ink-mute hover:bg-bg-soft hover:text-amber'}`}
                title={prodotto.nominativa ? 'Rimuovi nominativa' : 'Segna come nominativa (farmacia esterna)'}
              >
                {isPendingN ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors"
                title="Modifica"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Eliminare "${prodotto.principio_attivo}"?`)) return;
                  startDel(async () => { await deleteProdottoAction(prodotto.id, categoria); });
                }}
                disabled={isPendingDel}
                className="p-1.5 rounded hover:bg-bg-soft text-ink-mute hover:text-abx transition-colors"
                title="Elimina"
              >
                {isPendingDel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </td>
        )}
      </tr>
    </>
  );
}

const PRESET_GIORNI = [
  { label: '7 gg', value: 7 },
  { label: '14 gg', value: 14 },
  { label: '30 gg', value: 30 },
];

export function ProdottiView({ prodotti, docsLiberi, orgId, categoria, canEdit }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [giorni, setGiorni] = useState(7);
  const [customGiorni, setCustomGiorni] = useState('');
  const [modoCustom, setModoCustom] = useState(false);

  const giorniEffettivi = modoCustom ? (parseInt(customGiorni) || 1) : giorni;

  const ordinati = [...prodotti].sort((a, b) =>
    a.principio_attivo.localeCompare(b.principio_attivo) ||
    a.forma_farmaceutica.localeCompare(b.forma_farmaceutica)
  );

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nuovo prodotto
          </button>
        </div>
      )}

      {showForm && (
        <ProdottoForm orgId={orgId} categoria={categoria} onClose={() => setShowForm(false)} />
      )}

      {ordinati.length === 0 && docsLiberi.length === 0 ? (
        <div className="text-center py-16 text-ink-mute">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessun prodotto ancora.</p>
          {canEdit && <p className="text-xs mt-1">Carica un PDF e clicca "Estrai" oppure aggiungi manualmente.</p>}
        </div>
      ) : (
        <>
          {/* Selettore periodo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-ink-soft">Fabbisogno per:</span>
            {PRESET_GIORNI.map((p) => (
              <button
                key={p.value}
                onClick={() => { setGiorni(p.value); setModoCustom(false); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !modoCustom && giorni === p.value
                    ? 'bg-forest text-white border-forest'
                    : 'border-line text-ink-soft hover:border-forest/40'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setModoCustom(true)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                modoCustom ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
              }`}
            >
              Personalizzato
            </button>
            {modoCustom && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customGiorni}
                  onChange={(e) => setCustomGiorni(e.target.value)}
                  placeholder="gg"
                  className="w-16 px-2 py-1 text-xs border border-line rounded-lg text-center focus:outline-none focus:border-forest"
                  autoFocus
                />
                <span className="text-xs text-ink-mute">giorni</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-soft border-b border-line">
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide">Farmaco</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">/die</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-forest uppercase tracking-wide text-center">
                    {giorniEffettivi} gg
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wide text-center">Scorte</th>
                  {canEdit && <th className="px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {ordinati.map((p) => (
                  <RigaProdotto key={p.id} prodotto={p} categoria={categoria} canEdit={canEdit} giorni={giorniEffettivi} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Documenti liberi */}
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
