'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { Upload, Users, Bed, Loader2, Plus, Trash2, X, Calendar, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { estraiPazientiDaImmagineAction, estraiPazientiDaHtmlAction, eliminaPazienteAction, aggiungiPazienteAction } from '@/app/(app)/pazienti/actions';
import { assegnaTerapiaAction, rimuoviTerapiaAction } from '@/app/(app)/pazienti/terapie-actions';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';

export interface TerapiaPaziente {
  id: string;
  principio_attivo: string;
  dosaggio: string | null;
  posologia: string | null;
  tipo?: string;
}

export interface Paziente {
  id: string;
  sala: string;
  numero_letto: number;
  nominativo: string;
  piano: 'terra' | 'primo' | null;
  unita_operativa_id: string | null;
  data_aggiornamento: string;
  terapie?: TerapiaPaziente[];
}

export interface ProdottoSuggestion {
  id: string;
  principio_attivo: string;
  dosaggio: string | null;
}

interface Props {
  pazienti: Paziente[];
  orgId: string;
  orgName: string;
  uoNome: string | null;
  prodotti?: ProdottoSuggestion[];
}

const STORAGE_KEY = 'carico_selezione';

export function PazientiView({ pazienti, orgId, orgName, uoNome, prodotti = [] }: Props) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selezione, setSelezione] = useState<Record<string, boolean>>({});
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

  // Sale per piano
  const saleTerra = sale.filter((s) => {
    const p = pazienti.find((paz) => paz.sala === s);
    return p?.piano === 'terra';
  });
  const salePrimo = sale.filter((s) => {
    const p = pazienti.find((paz) => paz.sala === s);
    return p?.piano === 'primo';
  });

  // Load/persist selezione
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSelezione(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  function toggleSala(sala: string) {
    setSelezione((prev) => {
      const next = { ...prev, [sala]: !prev[sala] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function handleFile(file: File) {
    const isHtml = file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm') || file.type === 'text/html';
    if (isHtml) {
      // Prova UTF-8; se contiene caratteri sostitutivi (�) riprova con ISO-8859-1
      const tryRead = (encoding: string) => new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsText(file, encoding);
      });
      startTransition(async () => {
        setMsg(null);
        let text = await tryRead('utf-8');
        if (text.includes('�')) text = await tryRead('iso-8859-1');
        const res = await estraiPazientiDaHtmlAction(text, orgId);
        if ('error' in res) setMsg({ type: 'err', text: res.error ?? 'Errore sconosciuto.' });
        else setMsg({ type: 'ok', text: `${(res as { count: number }).count} pazienti caricati con successo.` });
      });
    } else {
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
          accept="image/jpeg,image/png,image/webp,image/bmp,text/html,.html,.htm"
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
                <p className="text-xs text-ink-soft mt-1">Screenshot (JPG/PNG) o file HTML · trascina qui o clicca</p>
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
              prodotti={prodotti}
            />
          ))}
        </div>
      )}

      {/* Carico farmacia schedule */}
      {(saleTerra.length > 0 || salePrimo.length > 0) && (
        <CaricoFarmaciaSection
          saleTerra={saleTerra}
          salePrimo={salePrimo}
          selezione={selezione}
          bySala={bySala}
          onToggle={toggleSala}
        />
      )}
    </div>
  );
}

// ── Carico Farmacia Section ──────────────────────────────────────────────────

interface CaricoProps {
  saleTerra: string[];
  salePrimo: string[];
  selezione: Record<string, boolean>;
  bySala: Record<string, Paziente[]>;
  onToggle: (sala: string) => void;
}

function CaricoFarmaciaSection({ saleTerra, salePrimo, selezione, onToggle, bySala }: CaricoProps) {
  function stampaFoglioCaricoHtml(sale: string[], titolo: string, data: string) {
    const selezionate = sale.filter((s) => selezione[s]);
    const blocchi = selezionate.map((sala) => {
      const paz = (bySala[sala] ?? []).sort((a, b) => a.numero_letto - b.numero_letto);
      const righe = paz.map((p) => {
        const farmaci = (p.terapie ?? []).filter((t) => t.tipo !== 'nutrizione');
        const nutrizioni = (p.terapie ?? []).filter((t) => t.tipo === 'nutrizione');
        const farmaciTxt = farmaci.length > 0
          ? farmaci.map((t) => [t.principio_attivo, t.dosaggio, t.posologia].filter(Boolean).join(' ')).join(' · ')
          : '&nbsp;';
        const nutrizioniTxt = nutrizioni.length > 0
          ? nutrizioni.map((t) => t.posologia ? `${t.principio_attivo} ${t.posologia}` : t.principio_attivo).join(' · ')
          : '&nbsp;';
        return `<tr>
          <td style="width:40px;text-align:center;font-weight:600;color:#374151">${p.numero_letto}</td>
          <td style="font-weight:500">${p.nominativo}</td>
          <td style="border-bottom:1px solid #d1d5db">${farmaciTxt}</td>
          <td style="border-bottom:1px solid #d1d5db;color:#065f46">${nutrizioniTxt}</td>
        </tr>`;
      }).join('');
      return `
        <div style="break-inside:avoid;margin-bottom:20px">
          <div style="background:#1f3d2b;color:white;padding:6px 10px;border-radius:6px 6px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">
            ${sala} <span style="font-weight:400;opacity:.7;margin-left:8px">${paz.length} pz</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:4px 8px;text-align:center;font-size:10px;color:#6b7280">Letto</th>
                <th style="padding:4px 8px;text-align:left;font-size:10px;color:#6b7280">Paziente</th>
                <th style="padding:4px 8px;text-align:left;font-size:10px;color:#6b7280">Farmaci / Note</th>
                <th style="padding:4px 8px;text-align:left;font-size:10px;color:#065f46">Nutrizioni</th>
              </tr>
            </thead>
            <tbody>${righe}</tbody>
          </table>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<title>${titolo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#111;padding:16px;font-size:12px}
  h1{font-size:14px;font-weight:700;margin-bottom:2px}
  .sub{font-size:10px;color:#6b7280;margin-bottom:16px}
  td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:middle}
  @media print{@page{size:A4;margin:1.2cm}body{padding:0}}
</style></head><body>
<h1>${titolo}</h1>
<div class="sub">Data: ${data} · Sale selezionate: ${selezionate.length} · Totale pazienti: ${selezionate.reduce((n, s) => n + (bySala[s]?.length ?? 0), 0)}</div>
${blocchi || '<p style="color:#9ca3af">Nessuna sala selezionata.</p>'}
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, '_blank');
    if (w) w.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url); });
  }

  const oggi = new Date().toLocaleDateString('it-IT');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Calendar className="w-4 h-4 text-forest" />
        Carico farmacia settimanale
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CaricoCard
          titolo="Carico Lunedì"
          sottotitolo="Piano Terra"
          sale={saleTerra}
          selezione={selezione}
          bySala={bySala}
          onToggle={onToggle}
          onPrint={() => stampaFoglioCaricoHtml(saleTerra, 'Foglio Carico Lunedì — Piano Terra', oggi)}
        />
        <CaricoCard
          titolo="Carico Giovedì"
          sottotitolo="Primo Piano"
          sale={salePrimo}
          selezione={selezione}
          bySala={bySala}
          onToggle={onToggle}
          onPrint={() => stampaFoglioCaricoHtml(salePrimo, 'Foglio Carico Giovedì — Primo Piano', oggi)}
        />
      </div>
    </div>
  );
}

interface CaricoCardProps {
  titolo: string;
  sottotitolo: string;
  sale: string[];
  selezione: Record<string, boolean>;
  bySala: Record<string, Paziente[]>;
  onToggle: (sala: string) => void;
  onPrint: () => void;
}

function CaricoCard({ titolo, sottotitolo, sale, selezione, bySala, onToggle, onPrint }: CaricoCardProps) {
  const selezionate = sale.filter((s) => selezione[s]).length;

  return (
    <div className="rounded-xl border border-line overflow-hidden bg-bg-card">
      <div className="px-3 py-2 bg-forest/10 border-b border-forest/20 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-forest uppercase tracking-wide">{titolo}</h3>
          <p className="text-[10px] text-forest/70">{sottotitolo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-forest bg-forest/10 px-2 py-0.5 rounded-full">
            {selezionate}/{sale.length}
          </span>
          <button
            onClick={onPrint}
            className="p-1 rounded text-forest hover:bg-forest/20 transition-colors"
            title="Stampa/condividi sale selezionate"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {sale.length === 0 ? (
        <div className="px-3 py-4 text-xs text-ink-mute text-center">Nessuna sala</div>
      ) : (
        <div className="divide-y divide-line/50">
          {sale.map((sala) => (
            <label
              key={sala}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-soft/40 transition-colors"
            >
              <input
                type="checkbox"
                checked={!!selezione[sala]}
                onChange={() => onToggle(sala)}
                className="w-3.5 h-3.5 accent-forest"
              />
              <span className="text-xs font-medium text-ink flex-1">{sala}</span>
              <span className="text-[10px] text-ink-mute">{bySala[sala]?.length ?? 0} pz</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card compatta per sala ───────────────────────────────────────────────────

function SalaCard({ sala, pazienti, prodotti }: { sala: string; pazienti: Paziente[]; prodotti: ProdottoSuggestion[] }) {
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <div key={p.id}>
            <div className="flex items-center gap-2 px-3 py-1.5 group hover:bg-bg-soft/40">
              <span className="w-7 text-right text-[11px] font-mono text-ink-mute shrink-0">{p.numero_letto}</span>
              <span className="flex-1 text-xs font-medium text-ink truncate">{p.nominativo}</span>
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="p-1 rounded text-ink-mute hover:text-forest hover:bg-forest/10 transition-colors"
                title="Terapie"
              >
                {expandedId === p.id
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={pending}
                className="p-1 rounded text-ink-mute hover:text-abx hover:bg-abx/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            {expandedId === p.id && (
              <TerapiePanel paziente={p} prodotti={prodotti} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pannello terapie ─────────────────────────────────────────────────────────

function TerapiePanel({ paziente, prodotti }: { paziente: Paziente; prodotti: ProdottoSuggestion[] }) {
  const [pending, startTransition] = useTransition();
  const [principio, setPrincipio] = useState('');
  const [dosaggio, setDosaggio] = useState('');
  const [posologia, setPosologia] = useState('');
  const listId = `prodotti-${paziente.id}`;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!principio.trim()) return;
    startTransition(async () => {
      const match = prodotti.find((p) => p.principio_attivo === principio);
      await assegnaTerapiaAction(paziente.id, principio.trim(), dosaggio.trim(), posologia.trim(), match?.id);
      setPrincipio('');
      setDosaggio('');
      setPosologia('');
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => { await rimuoviTerapiaAction(id); });
  }

  return (
    <div className="bg-bg-soft/60 border-t border-line/50 px-3 py-2 space-y-1.5">
      {/* Lista terapie assegnate */}
      {(paziente.terapie ?? []).length === 0 ? (
        <p className="text-[10px] text-ink-mute italic">Nessuna terapia assegnata</p>
      ) : (
        <ul className="space-y-0.5">
          {(paziente.terapie ?? []).map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 group/t">
              <span className="flex-1 text-xs text-ink">
                <span className="font-medium">{t.principio_attivo}</span>
                {t.dosaggio && <span className="text-ink-soft"> {t.dosaggio}</span>}
                {t.posologia && <span className="text-ink-mute"> · {t.posologia}</span>}
              </span>
              <button
                onClick={() => handleRemove(t.id)}
                disabled={pending}
                className="p-0.5 rounded text-ink-mute hover:text-abx hover:bg-abx/10 transition-colors opacity-0 group-hover/t:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Form aggiunta */}
      <form onSubmit={handleAdd} className="flex items-center gap-1 pt-1">
        <datalist id={listId}>
          {prodotti.map((p) => (
            <option key={p.id} value={p.principio_attivo} />
          ))}
        </datalist>
        <input
          type="text"
          list={listId}
          placeholder="Principio attivo"
          value={principio}
          onChange={(e) => setPrincipio(e.target.value)}
          className="input-base text-xs py-1 flex-[2] min-w-0"
          required
        />
        <input
          type="text"
          placeholder="Dosaggio"
          value={dosaggio}
          onChange={(e) => setDosaggio(e.target.value)}
          className="input-base text-xs py-1 flex-1 min-w-0"
        />
        <input
          type="text"
          placeholder="Posologia"
          value={posologia}
          onChange={(e) => setPosologia(e.target.value)}
          className="input-base text-xs py-1 flex-1 min-w-0"
        />
        <button
          type="submit"
          disabled={pending || !principio.trim()}
          className="p-1 rounded bg-forest text-white hover:bg-forest/90 disabled:opacity-40 transition-colors shrink-0"
          title="Aggiungi terapia"
        >
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </form>
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
