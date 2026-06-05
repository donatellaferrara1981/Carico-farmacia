'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Eye, EyeOff, Loader2, Building2 } from 'lucide-react';
import { aggiungiUnitaAction, toggleUnitaAction, eliminaUnitaAction } from '@/app/(app)/impostazioni/actions';

interface UnitaOperativa {
  id: string;
  nome: string;
  attiva: boolean;
}

export function UnitaOperativeManager({
  unita,
  orgId,
  canEdit,
}: {
  unita: UnitaOperativa[];
  orgId: string;
  canEdit: boolean;
}) {
  const [nome, setNome] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await aggiungiUnitaAction(orgId, nome);
      if ('error' in res) { setError(res.error ?? null); return; }
      setNome('');
    });
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-forest-tint flex items-center justify-center">
            <Building2 className="w-5 h-5 text-forest" />
          </div>
          <div>
            <h2 className="font-semibold text-ink">Unità Operative</h2>
            <p className="text-xs text-ink-soft">Reparti che gestisci con questa app</p>
          </div>
        </div>

        {/* Lista unità */}
        <div className="divide-y divide-line">
          {unita.length === 0 && (
            <p className="text-sm text-ink-mute py-4 text-center">Nessuna unità operativa ancora.</p>
          )}
          {unita.map((u) => (
            <UnitaRow key={u.id} unita={u} canEdit={canEdit} />
          ))}
        </div>

        {/* Aggiungi nuova */}
        {canEdit && (
          <form onSubmit={handleAdd} className="flex gap-2 mt-4">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-base flex-1"
              placeholder="es. GCA3, Neuro Riabilitazione…"
              disabled={isPending}
            />
            <button type="submit" disabled={isPending || !nome.trim()} className="btn-primary px-4">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </form>
        )}
        {error && <p className="text-xs text-abx mt-2">{error}</p>}
      </div>
    </div>
  );
}

function UnitaRow({ unita, canEdit }: { unita: UnitaOperativa; canEdit: boolean }) {
  const [isPending, start] = useTransition();

  function handleToggle() {
    start(async () => { await toggleUnitaAction(unita.id, !unita.attiva); });
  }

  function handleDelete() {
    if (!confirm(`Eliminare "${unita.nome}"? I documenti collegati non saranno eliminati.`)) return;
    start(async () => { await eliminaUnitaAction(unita.id); });
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`flex-1 text-sm font-medium ${unita.attiva ? 'text-ink' : 'text-ink-mute line-through'}`}>
        {unita.nome}
      </span>
      {!unita.attiva && <span className="text-xs text-ink-mute bg-bg-soft px-2 py-0.5 rounded-full">inattiva</span>}
      {canEdit && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggle}
            disabled={isPending}
            className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors"
            title={unita.attiva ? 'Disattiva' : 'Attiva'}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : unita.attiva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="p-1.5 rounded-lg hover:bg-abx-soft text-ink-mute hover:text-abx transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
