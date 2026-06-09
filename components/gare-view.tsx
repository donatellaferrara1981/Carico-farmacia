'use client';

import { useState, useTransition, useMemo } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, AlertTriangle, Search, FileText } from 'lucide-react';
import { aggiungiGaraAction, modificaGaraAction, eliminaGaraAction } from '@/app/(app)/gare/actions';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';

export interface Gara {
  id: string;
  numero_gara: string;
  descrizione: string;
  categoria: 'farmaci' | 'sanitario' | 'entrambi';
  ditta_aggiudicataria: string;
  prezzo_unitario: number | null;
  unita_misura: string | null;
  data_inizio: string | null;
  data_scadenza: string | null;
  lotto: string | null;
  aic: string | null;
  note: string | null;
}

const CAT_LABEL: Record<string, string> = {
  farmaci: 'Farmaci',
  sanitario: 'Sanitario',
  entrambi: 'Farmaci + Sanitario',
};
const CAT_COLOR: Record<string, string> = {
  farmaci: 'bg-forest/10 text-forest border-forest/20',
  sanitario: 'bg-amber/10 text-amber-700 border-amber/20',
  entrambi: 'bg-purple-50 text-purple-700 border-purple-200',
};

function giorniAllaScadenza(dataScadenza: string | null): number | null {
  if (!dataScadenza) return null;
  const diff = new Date(dataScadenza).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ScadenzaBadge({ data }: { data: string | null }) {
  if (!data) return <span className="text-ink-mute text-xs">—</span>;
  const giorni = giorniAllaScadenza(data);
  const label = new Date(data).toLocaleDateString('it-IT');
  if (giorni === null) return <span className="text-xs">{label}</span>;
  if (giorni < 0) return <span className="text-xs font-bold text-abx">SCADUTA ({label})</span>;
  if (giorni <= 30) return <span className="text-xs font-bold text-amber">{label} <span className="text-[10px]">({giorni}gg)</span></span>;
  return <span className="text-xs text-ink">{label}</span>;
}

export function GareView({ gare, orgName }: { gare: Gara[]; orgName: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  const [filtroCat, setFiltroCat] = useState<'tutti' | 'farmaci' | 'sanitario' | 'entrambi'>('tutti');

  const scadute = gare.filter(g => (giorniAllaScadenza(g.data_scadenza) ?? 1) < 0).length;
  const inScadenza = gare.filter(g => { const d = giorniAllaScadenza(g.data_scadenza); return d !== null && d >= 0 && d <= 30; }).length;

  const filtrare = useMemo(() => {
    return gare.filter(g => {
      const matchCat = filtroCat === 'tutti' || g.categoria === filtroCat;
      const q = cerca.toLowerCase();
      const matchQ = !q || g.descrizione.toLowerCase().includes(q) || g.numero_gara.toLowerCase().includes(q) || g.ditta_aggiudicataria.toLowerCase().includes(q) || (g.aic ?? '').toLowerCase().includes(q) || (g.lotto ?? '').toLowerCase().includes(q);
      return matchCat && matchQ;
    }).sort((a, b) => {
      // scadute prima, poi per data scadenza
      const da = giorniAllaScadenza(a.data_scadenza) ?? 9999;
      const db = giorniAllaScadenza(b.data_scadenza) ?? 9999;
      return da - db;
    });
  }, [gare, cerca, filtroCat]);

  function testoCondivisione() {
    const lines = [`📋 Gare d'appalto — ${orgName}`, `Data: ${new Date().toLocaleDateString('it-IT')}`, ''];
    for (const g of filtrare) {
      lines.push(`• [${g.numero_gara}] ${g.descrizione}`);
      lines.push(`  Ditta: ${g.ditta_aggiudicataria}${g.prezzo_unitario ? ` · € ${g.prezzo_unitario.toFixed(4)}/${g.unita_misura ?? 'pz'}` : ''}`);
      if (g.data_scadenza) lines.push(`  Scadenza: ${new Date(g.data_scadenza).toLocaleDateString('it-IT')}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  function generaHtml() {
    const righe = filtrare.map(g => {
      const giorni = giorniAllaScadenza(g.data_scadenza);
      const scadClass = giorni !== null && giorni < 0 ? 'red' : giorni !== null && giorni <= 30 ? '' : '';
      return `<tr>
        <td>${g.numero_gara}</td>
        <td><strong>${g.descrizione}</strong>${g.aic ? `<br><span style="color:#6b7280;font-size:9px">AIC: ${g.aic}</span>` : ''}</td>
        <td>${CAT_LABEL[g.categoria]}</td>
        <td>${g.ditta_aggiudicataria}${g.lotto ? `<br><span style="color:#6b7280;font-size:9px">Lotto: ${g.lotto}</span>` : ''}</td>
        <td class="num">${g.prezzo_unitario != null ? `€ ${g.prezzo_unitario.toFixed(4)}` : '—'}${g.unita_misura ? `<br><span style="font-size:9px">/${g.unita_misura}</span>` : ''}</td>
        <td class="${scadClass}">${g.data_scadenza ? new Date(g.data_scadenza).toLocaleDateString('it-IT') : '—'}</td>
      </tr>`;
    }).join('');
    const corpo = `<table><thead><tr><th>N° Gara</th><th>Descrizione</th><th>Categoria</th><th>Ditta</th><th class="num">Prezzo</th><th>Scadenza</th></tr></thead><tbody>${righe}</tbody></table>`;
    return htmlBase(`Gare d'appalto — ${orgName}`, `Regione Sicilia · ${new Date().toLocaleDateString('it-IT')} · ${filtrare.length} gare`, corpo);
  }

  const editGara = gare.find(g => g.id === editId) ?? null;

  return (
    <div className="space-y-6">
      {/* Alert scadenze */}
      {(scadute > 0 || inScadenza > 0) && (
        <div className="flex flex-wrap gap-3">
          {scadute > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-abx/10 border border-abx/30 text-sm text-abx">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <strong>{scadute}</strong> gara{scadute > 1 ? 'e' : ''} scadut{scadute > 1 ? 'e' : 'a'}
            </div>
          )}
          {inScadenza > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber/10 border border-amber/30 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <strong>{inScadenza}</strong> gara{inScadenza > 1 ? 'e' : ''} in scadenza (≤30 giorni)
            </div>
          )}
        </div>
      )}

      {/* Barra azioni */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Filtro categoria */}
          {(['tutti', 'farmaci', 'sanitario', 'entrambi'] as const).map(c => (
            <button
              key={c}
              onClick={() => setFiltroCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filtroCat === c ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'}`}
            >
              {c === 'tutti' ? 'Tutte' : CAT_LABEL[c]}
            </button>
          ))}
          {/* Cerca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              type="text"
              placeholder="Cerca farmaco, ditta, AIC…"
              value={cerca}
              onChange={e => setCerca(e.target.value)}
              className="input-base pl-7 pr-3 py-1.5 text-xs w-48"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SharePrintBar
            titolo={`Gare d'appalto — ${orgName}`}
            testoCondivisione={testoCondivisione}
            generaHtml={generaHtml}
          />
          <button onClick={() => { setEditId(null); setShowForm(true); }} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Nuova gara
          </button>
        </div>
      </div>

      {/* Form aggiungi/modifica */}
      {(showForm || editId) && (
        <GaraForm
          gara={editGara}
          onClose={() => { setShowForm(false); setEditId(null); }}
        />
      )}

      {/* Tabella */}
      {filtrare.length === 0 ? (
        <div className="text-center py-16 text-ink-mute">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{gare.length === 0 ? 'Nessuna gara inserita.' : 'Nessun risultato per i filtri selezionati.'}</p>
          {gare.length === 0 && <p className="text-xs mt-1">Clicca "Nuova gara" per aggiungere la prima.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-soft border-b border-line text-left">
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft">N° Gara</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Descrizione / AIC</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Cat.</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Ditta / Lotto</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft text-right">Prezzo</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Scadenza</th>
                <th className="px-3 py-3 text-xs font-semibold text-ink-soft"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtrare.map(g => (
                <GaraRow
                  key={g.id}
                  gara={g}
                  onEdit={() => { setEditId(g.id); setShowForm(false); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Riga tabella ──────────────────────────────────────────────────────────────

function GaraRow({ gara: g, onEdit }: { gara: Gara; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Eliminare la gara "${g.numero_gara} — ${g.descrizione}"?`)) return;
    startTransition(async () => { await eliminaGaraAction(g.id); });
  }

  return (
    <tr className="hover:bg-bg-soft/40 group">
      <td className="px-3 py-2.5 text-xs font-mono text-ink-soft whitespace-nowrap">{g.numero_gara}</td>
      <td className="px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">{g.descrizione}</p>
        {g.aic && <p className="text-[10px] text-ink-mute">AIC: {g.aic}</p>}
        {g.note && <p className="text-[10px] text-ink-mute italic mt-0.5">{g.note}</p>}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CAT_COLOR[g.categoria]}`}>
          {CAT_LABEL[g.categoria]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-xs text-ink">{g.ditta_aggiudicataria}</p>
        {g.lotto && <p className="text-[10px] text-ink-mute">Lotto: {g.lotto}</p>}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
        {g.prezzo_unitario != null ? (
          <>
            <span className="text-xs font-semibold text-ink">€ {g.prezzo_unitario.toFixed(4)}</span>
            {g.unita_misura && <span className="text-[10px] text-ink-mute">/{g.unita_misura}</span>}
          </>
        ) : <span className="text-xs text-ink-mute">—</span>}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <ScadenzaBadge data={g.data_scadenza} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1 text-ink-mute hover:text-forest">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={pending} className="p-1 text-ink-mute hover:text-abx">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

function GaraForm({ gara, onClose }: { gara: Gara | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = gara
        ? await modificaGaraAction(gara.id, fd)
        : await aggiungiGaraAction(fd);
      if ('error' in res && res.error) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink text-sm">{gara ? 'Modifica gara' : 'Nuova gara d\'appalto'}</p>
        <button type="button" onClick={onClose}><X className="w-4 h-4 text-ink-mute" /></button>
      </div>

      {error && <p className="text-xs text-abx bg-abx/10 px-3 py-2 rounded-lg">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">N° Gara *</label>
          <input name="numero_gara" defaultValue={gara?.numero_gara} required className="input-base w-full text-sm" placeholder="es. 2024/001" />
        </div>
        <div>
          <label className="label-xs">Categoria *</label>
          <select name="categoria" defaultValue={gara?.categoria ?? 'farmaci'} className="input-base w-full text-sm">
            <option value="farmaci">Farmaci</option>
            <option value="sanitario">Sanitario</option>
            <option value="entrambi">Farmaci + Sanitario</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label-xs">Descrizione farmaco/prodotto *</label>
        <input name="descrizione" defaultValue={gara?.descrizione} required className="input-base w-full text-sm" placeholder="es. Amoxicillina + Ac. Clavulanico 875mg cpr" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">AIC</label>
          <input name="aic" defaultValue={gara?.aic ?? ''} className="input-base w-full text-sm" placeholder="Codice AIC" />
        </div>
        <div>
          <label className="label-xs">Lotto</label>
          <input name="lotto" defaultValue={gara?.lotto ?? ''} className="input-base w-full text-sm" placeholder="N° lotto gara" />
        </div>
      </div>

      <div>
        <label className="label-xs">Ditta aggiudicataria *</label>
        <input name="ditta_aggiudicataria" defaultValue={gara?.ditta_aggiudicataria} required className="input-base w-full text-sm" placeholder="Ragione sociale" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">Prezzo unitario (€)</label>
          <input name="prezzo_unitario" defaultValue={gara?.prezzo_unitario ?? ''} type="number" step="0.0001" min="0" className="input-base w-full text-sm" placeholder="0,0000" />
        </div>
        <div>
          <label className="label-xs">Unità di misura</label>
          <input name="unita_misura" defaultValue={gara?.unita_misura ?? ''} className="input-base w-full text-sm" placeholder="cpr, fl, pz, conf…" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">Data inizio</label>
          <input name="data_inizio" defaultValue={gara?.data_inizio ?? ''} type="date" className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="label-xs">Data scadenza</label>
          <input name="data_scadenza" defaultValue={gara?.data_scadenza ?? ''} type="date" className="input-base w-full text-sm" />
        </div>
      </div>

      <div>
        <label className="label-xs">Note</label>
        <textarea name="note" defaultValue={gara?.note ?? ''} rows={2} className="input-base w-full text-sm resize-none" placeholder="Eventuali note…" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost text-sm">Annulla</button>
        <button type="submit" disabled={pending} className="btn-primary text-sm">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {gara ? 'Salva modifiche' : 'Aggiungi gara'}
        </button>
      </div>
    </form>
  );
}
