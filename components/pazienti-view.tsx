'use client';

import { useState, useRef, useTransition } from 'react';
import { Upload, Users, Bed, Loader2, Plus, Trash2, RefreshCw, X } from 'lucide-react';
import { estraiPazientiDaImmagineAction, eliminaPazienteAction, aggiungiPazienteAction } from '@/app/(app)/pazienti/actions';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';

export interface Paziente {
  id: string;
  sala: string;
  numero_letto: number;
  nominativo: string;
  unita_operativa_id: string | null;
  data_aggiornamento: string;
}

interface Props {
  pazienti: Paziente[];
  orgId: string;
  orgName: string;
  uoNome: string | null;
}

export function PazientiView({ pazienti, orgId, orgName, uoNome }: Props) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Raggruppa per sala
  const bySala = pazienti.reduce<Record<string, Paziente[]>>((acc, p) => {
    acc[p.sala] = [...(acc[p.sala] ?? []), p];
    return acc;
  }, {});
  const sale = Object.keys(bySala).sort();
  const totale = pazienti.length;

  const dataStr = pazienti[0]
    ? new Date(pazienti[0].data_aggiornamento).toLocaleString('it-IT')
    : null;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      startTransition(async () => {
        setMsg(null);
        const res = await estraiPazientiDaImmagineAction(b64, mediaType as 'image/jpeg' | 'image/png' | 'image/webp', orgId);
        if ('error' in res) setMsg({ type: 'err', text: res.error ?? 'Errore sconosciuto.' });
        else setMsg({ type: 'ok', text: `${res.count} pazienti caricati con successo.` });
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function testoCondivisione() {
    const lines = [`👥 Pazienti ricoverati — ${uoNome ?? orgName}`, `Aggiornamento: ${dataStr ?? '—'}`, ''];
    for (const sala of sale) {
      lines.push(`\n🏥 ${sala.toUpperCase()} (${bySala[sala].length} pazienti)`);
      for (const p of bySala[sala].sort((a, b) => a.numero_letto - b.numero_letto)) {
        lines.push(`  Letto ${p.numero_letto}: ${p.nominativo}`);
      }
    }
    lines.push(`\nTotale: ${totale} pazienti`);
    return lines.join('\n');
  }

  function generaHtml() {
    const tabelle = sale.map((sala) => {
      const righe = bySala[sala]
        .sort((a, b) => a.numero_letto - b.numero_letto)
        .map((p) => `<tr><td class="num">${p.numero_letto}</td><td>${p.nominativo}</td></tr>`)
        .join('');
      return `<h2 style="font-size:11px;font-weight:700;margin:10px 0 4px;text-transform:uppercase;color:#1f3d2b">${sala} — ${bySala[sala].length} pazienti</h2>
<table><thead><tr><th class="num">Letto</th><th>Nominativo</th></tr></thead><tbody>${righe}</tbody></table>`;
    }).join('');
    return htmlBase(
      `Pazienti ricoverati — ${uoNome ?? orgName}`,
      `Aggiornamento: ${dataStr ?? '—'} · Totale: ${totale}`,
      tabelle,
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        className="card border-2 border-dashed border-line hover:border-forest/40 transition-colors cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <div className="flex flex-col items-center py-6 gap-3 text-center pointer-events-none">
          {isPending ? (
            <>
              <Loader2 className="w-8 h-8 text-forest animate-spin" />
              <p className="text-sm text-ink-soft">Analisi in corso…</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-ink-mute" />
              <div>
                <p className="text-sm font-medium text-ink">Carica mappa posti letto</p>
                <p className="text-xs text-ink-soft mt-1">JPEG o PNG · trascina qui o clicca</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messaggio esito */}
      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${msg.type === 'ok' ? 'bg-forest/10 text-forest border border-forest/20' : 'bg-abx/10 text-abx border border-abx/20'}`}>
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="w-4 h-4 shrink-0" /></button>
        </div>
      )}

      {/* Header + azioni */}
      {totale > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-ink-soft">
              <Users className="w-4 h-4" />
              <span className="font-semibold text-ink text-lg">{totale}</span> pazienti ricoverati
            </div>
            {dataStr && <span className="text-xs text-ink-mute">· agg. {dataStr}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="btn-ghost text-sm"
            >
              <Plus className="w-4 h-4" /> Aggiungi
            </button>
            <SharePrintBar
              titolo={`Pazienti — ${uoNome ?? orgName}`}
              testoCondivisione={testoCondivisione}
              generaHtml={generaHtml}
            />
          </div>
        </div>
      )}

      {/* Form aggiungi manuale */}
      {showAdd && (
        <AddPazienteForm
          sale={sale}
          orgId={orgId}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Tabelle per sala */}
      {totale === 0 ? (
        <div className="text-center py-16 text-ink-mute">
          <Bed className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nessun paziente caricato.</p>
          <p className="text-xs mt-1">Carica la mappa dei posti letto per popolare automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sale.map((sala) => (
            <SalaCard
              key={sala}
              sala={sala}
              pazienti={bySala[sala].sort((a, b) => a.numero_letto - b.numero_letto)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card compatta per sala ───────────────────────────────────────────────────

function SalaCard({ sala, pazienti }: { sala: string; pazienti: Paziente[] }) {
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => { await eliminaPazienteAction(id); });
  }

  return (
    <div className="rounded-xl border border-line overflow-hidden bg-bg-card">
      <div className="px-3 py-2 bg-forest/10 border-b border-forest/20 flex items-center justify-between">
        <h3 className="text-xs font-bold text-forest uppercase tracking-wide">{sala}</h3>
        <span className="text-xs font-semibold text-forest bg-forest/10 px-2 py-0.5 rounded-full">
          {pazienti.length} pz
        </span>
      </div>
      <div className="divide-y divide-line/50">
        {pazienti.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 group hover:bg-bg-soft/40">
            <span className="w-7 text-right text-[11px] font-mono text-ink-mute shrink-0">{p.numero_letto}</span>
            <span className="flex-1 text-xs font-medium text-ink truncate">{p.nominativo}</span>
            <button
              onClick={() => handleDelete(p.id)}
              disabled={pending}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-ink-mute hover:text-abx transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Form aggiungi paziente ───────────────────────────────────────────────────

function AddPazienteForm({ sale, orgId, onClose }: { sale: string[]; orgId: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [nuovaSala, setNuovaSala] = useState('');
  const [salaScelta, setSalaScelta] = useState(sale[0] ?? '');

  const salaFinale = salaScelta === '__nuova__' ? nuovaSala : salaScelta;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('sala', salaFinale);
    startTransition(async () => {
      await aggiungiPazienteAction(fd);
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <p className="text-sm font-medium text-ink">Aggiungi paziente</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-soft mb-1 block">Sala</label>
          <select
            className="input-base w-full text-sm"
            value={salaScelta}
            onChange={(e) => setSalaScelta(e.target.value)}
          >
            {sale.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__nuova__">+ Nuova sala…</option>
          </select>
          {salaScelta === '__nuova__' && (
            <input
              type="text"
              placeholder="Nome sala"
              value={nuovaSala}
              onChange={(e) => setNuovaSala(e.target.value)}
              className="input-base w-full text-sm mt-2"
              required
            />
          )}
        </div>
        <div>
          <label className="text-xs text-ink-soft mb-1 block">N° letto</label>
          <input type="number" name="numero_letto" min={1} max={99} className="input-base w-full text-sm" required />
        </div>
      </div>
      <div>
        <label className="text-xs text-ink-soft mb-1 block">Nominativo</label>
        <input type="text" name="nominativo" placeholder="COGNOME NOME" className="input-base w-full text-sm" required />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="btn-ghost text-sm">Annulla</button>
        <button type="submit" disabled={pending} className="btn-primary text-sm">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Salva
        </button>
      </div>
    </form>
  );
}
