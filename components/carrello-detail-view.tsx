'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import {
  aggiungiArticoloAction,
  eliminaArticoloAction,
  aggiornaArticoloAction,
  rinominaCarrelloAction,
} from '@/app/(app)/carrelli/actions';

interface Articolo {
  id: string;
  nome_articolo: string;
  forma_farmaceutica: string | null;
  dosaggio: string | null;
  lotto: string | null;
  data_scadenza: string | null;
  data_alert: string | null;
  quantita: number | null;
  note: string | null;
}

interface Carrello {
  id: string;
  nome: string;
  descrizione: string | null;
}

interface Props {
  carrello: Carrello;
  articoli: Articolo[];
  orgId: string;
  canEdit: boolean;
}

function formatMmYy(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${yy}`;
}

function formatGgMmYyyy(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${gg}/${mm}/${yyyy}`;
}

function alertColor(dataAlert: string | null): 'red' | 'amber' | 'green' {
  if (!dataAlert) return 'green';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alert = new Date(dataAlert);
  const tra30 = new Date(today);
  tra30.setDate(tra30.getDate() + 30);
  if (alert <= today) return 'red';
  if (alert <= tra30) return 'amber';
  return 'green';
}

const COLOR_CLASSES = {
  red: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    row: 'border-red-200',
  },
  amber: {
    dot: 'bg-amber',
    badge: 'bg-amber/10 text-amber',
    row: 'border-amber/30',
  },
  green: {
    dot: 'bg-forest',
    badge: 'bg-forest/10 text-forest',
    row: 'border-line',
  },
};

export function CarrelloDetailView({ carrello, articoli, orgId, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingCart, setRenamingCart] = useState(false);
  const [cartName, setCartName] = useState(carrello.nome);

  // New article form state
  const [form, setForm] = useState({
    nome_articolo: '',
    forma_farmaceutica: '',
    dosaggio: '',
    lotto: '',
    data_scadenza: '',
    quantita: '1',
    note: '',
  });

  // Edit article form state
  const [editForm, setEditForm] = useState<typeof form & { id: string }>({
    id: '',
    nome_articolo: '',
    forma_farmaceutica: '',
    dosaggio: '',
    lotto: '',
    data_scadenza: '',
    quantita: '1',
    note: '',
  });

  function startEdit(a: Articolo) {
    setEditingId(a.id);
    setEditForm({
      id: a.id,
      nome_articolo: a.nome_articolo,
      forma_farmaceutica: a.forma_farmaceutica ?? '',
      dosaggio: a.dosaggio ?? '',
      lotto: a.lotto ?? '',
      data_scadenza: a.data_scadenza ?? '',
      quantita: String(a.quantita ?? 1),
      note: a.note ?? '',
    });
  }

  function handleAdd() {
    if (!form.nome_articolo.trim() || !form.data_scadenza) return;
    setError(null);
    startTransition(async () => {
      try {
        await aggiungiArticoloAction(carrello.id, orgId, {
          nome_articolo: form.nome_articolo.trim(),
          forma_farmaceutica: form.forma_farmaceutica || undefined,
          dosaggio: form.dosaggio || undefined,
          lotto: form.lotto || undefined,
          data_scadenza: form.data_scadenza,
          quantita: parseInt(form.quantita) || 1,
          note: form.note || undefined,
        });
        setForm({ nome_articolo: '', forma_farmaceutica: '', dosaggio: '', lotto: '', data_scadenza: '', quantita: '1', note: '' });
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore');
      }
    });
  }

  function handleUpdate() {
    if (!editForm.nome_articolo.trim() || !editForm.data_scadenza) return;
    setError(null);
    startTransition(async () => {
      try {
        await aggiornaArticoloAction(editForm.id, {
          nome_articolo: editForm.nome_articolo.trim(),
          forma_farmaceutica: editForm.forma_farmaceutica || undefined,
          dosaggio: editForm.dosaggio || undefined,
          lotto: editForm.lotto || undefined,
          data_scadenza: editForm.data_scadenza,
          quantita: parseInt(editForm.quantita) || 1,
          note: editForm.note || undefined,
        });
        setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore');
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Eliminare questo articolo?')) return;
    startTransition(async () => {
      try {
        await eliminaArticoloAction(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore');
      }
    });
  }

  function handleRenameCart() {
    if (!cartName.trim() || cartName === carrello.nome) { setRenamingCart(false); return; }
    startTransition(async () => {
      try {
        await rinominaCarrelloAction(carrello.id, cartName.trim());
        setRenamingCart(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore');
      }
    });
  }

  const inputCls = 'px-2 py-1.5 text-sm rounded-lg border border-line bg-bg focus:outline-none focus:ring-1 focus:ring-forest';

  function ArticleFormFields({
    values,
    onChange,
  }: {
    values: typeof form;
    onChange: (k: string, v: string) => void;
  }) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-ink-mute mb-0.5 block">Nome articolo *</label>
          <input
            type="text"
            value={values.nome_articolo}
            onChange={(e) => onChange('nome_articolo', e.target.value)}
            placeholder="es. Adrenalina"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div>
          <label className="text-xs text-ink-mute mb-0.5 block">Forma farmaceutica</label>
          <input type="text" value={values.forma_farmaceutica} onChange={(e) => onChange('forma_farmaceutica', e.target.value)} placeholder="es. fl" className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="text-xs text-ink-mute mb-0.5 block">Dosaggio</label>
          <input type="text" value={values.dosaggio} onChange={(e) => onChange('dosaggio', e.target.value)} placeholder="es. 1mg/ml" className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="text-xs text-ink-mute mb-0.5 block">Lotto</label>
          <input type="text" value={values.lotto} onChange={(e) => onChange('lotto', e.target.value)} placeholder="es. AB1234" className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="text-xs text-ink-mute mb-0.5 block">Scadenza *</label>
          <input type="date" value={values.data_scadenza} onChange={(e) => onChange('data_scadenza', e.target.value)} className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="text-xs text-ink-mute mb-0.5 block">Quantità</label>
          <input type="number" min="1" value={values.quantita} onChange={(e) => onChange('quantita', e.target.value)} className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="text-xs text-ink-mute mb-0.5 block">Note</label>
          <input type="text" value={values.note} onChange={(e) => onChange('note', e.target.value)} placeholder="opzionale" className={`w-full ${inputCls}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart name / rename */}
      <div className="flex items-center gap-2">
        {renamingCart ? (
          <>
            <input
              autoFocus
              type="text"
              value={cartName}
              onChange={(e) => setCartName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCart(); if (e.key === 'Escape') { setRenamingCart(false); setCartName(carrello.nome); } }}
              className={`flex-1 text-sm font-semibold ${inputCls}`}
            />
            <button onClick={handleRenameCart} className="p-1.5 rounded-lg bg-forest text-white" disabled={isPending}><Check className="w-4 h-4" /></button>
            <button onClick={() => { setRenamingCart(false); setCartName(carrello.nome); }} className="p-1.5 rounded-lg border border-line text-ink-soft"><X className="w-4 h-4" /></button>
          </>
        ) : (
          canEdit && (
            <button
              onClick={() => setRenamingCart(true)}
              className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink font-medium"
            >
              <Pencil className="w-3.5 h-3.5" />
              Rinomina carrello
            </button>
          )
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Articles list */}
      <div className="space-y-2">
        {articoli.length === 0 && !showForm && (
          <p className="text-sm text-ink-mute text-center py-6">Nessun articolo nel carrello.</p>
        )}

        {articoli.map((a) => {
          const color = alertColor(a.data_alert);
          const cls = COLOR_CLASSES[color];

          if (editingId === a.id) {
            return (
              <div key={a.id} className={`rounded-xl border p-4 bg-bg-soft ${cls.row}`}>
                <ArticleFormFields
                  values={editForm}
                  onChange={(k, v) => setEditForm((prev) => ({ ...prev, [k]: v }))}
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={handleUpdate} disabled={isPending} className="px-3 py-1.5 text-sm rounded-lg bg-forest text-white font-medium disabled:opacity-50">Salva</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink-soft">Annulla</button>
                </div>
              </div>
            );
          }

          return (
            <div key={a.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border bg-bg-card ${cls.row}`}>
              <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${cls.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{a.nome_articolo}</span>
                  {a.dosaggio && <span className="text-xs text-ink-soft">{a.dosaggio}</span>}
                  {a.forma_farmaceutica && <span className="text-xs text-ink-mute">{a.forma_farmaceutica}</span>}
                  {a.quantita && a.quantita > 1 && (
                    <span className="text-xs bg-bg-soft border border-line text-ink-soft px-1.5 py-0.5 rounded">x{a.quantita}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {a.lotto && <span className="text-xs text-ink-mute">Lotto: {a.lotto}</span>}
                  {a.data_scadenza && <span className="text-xs text-ink-mute">Scad. {formatMmYy(a.data_scadenza)}</span>}
                  {a.data_alert && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cls.badge}`}>
                      Controllo: {formatGgMmYyyy(a.data_alert)}
                    </span>
                  )}
                  {a.note && <span className="text-xs text-ink-mute italic">{a.note}</span>}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(a)} className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute hover:text-ink transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-ink-mute hover:text-red-600 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add article form */}
      {canEdit && (
        <div>
          {showForm ? (
            <div className="rounded-xl border border-line bg-bg-soft p-4">
              <p className="text-xs font-medium text-ink-soft mb-3 uppercase tracking-wide">Nuovo articolo</p>
              <ArticleFormFields
                values={form}
                onChange={(k, v) => setForm((prev) => ({ ...prev, [k]: v }))}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAdd}
                  disabled={isPending || !form.nome_articolo.trim() || !form.data_scadenza}
                  className="px-3 py-1.5 text-sm rounded-lg bg-forest text-white font-medium disabled:opacity-50"
                >
                  Aggiungi
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm({ nome_articolo: '', forma_farmaceutica: '', dosaggio: '', lotto: '', data_scadenza: '', quantita: '1', note: '' }); }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink-soft"
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-forest hover:text-forest/80 font-medium"
            >
              <Plus className="w-4 h-4" />
              Aggiungi articolo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
