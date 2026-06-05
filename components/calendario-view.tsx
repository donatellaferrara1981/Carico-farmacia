'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Trash2, Loader2, Calendar,
  Eye, Share2, Printer, ChevronRight, FileDown, Mail, Copy, Check, ShieldAlert,
} from 'lucide-react';
import { eliminaPianoAction } from '@/app/(app)/[categoria]/piani-actions';
import type { RigaPiano } from '@/app/(app)/[categoria]/piani-actions';
import { classificaFarmaco, CLASSE_LABEL } from '@/lib/antibiotici';

interface Piano {
  id: string;
  categoria: string;
  titolo: string;
  data_inizio: string;
  data_fine: string;
  giorni: number;
  note: string | null;
  righe: RigaPiano[];
  created_at: string;
}

const CAT_COLORS: Record<string, string> = {
  terapie: 'bg-forest-tint text-forest border-forest/20',
  nutrizioni: 'bg-amber/10 text-amber border-amber/20',
  sanitario: 'bg-blue-50 text-blue-600 border-blue-200',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Modale dettaglio piano ───────────────────────────────────────────────────
function PianoDetailModal({ piano, onClose }: { piano: Piano; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg-card rounded-2xl border border-line shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-line flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{piano.titolo}</h2>
            <p className="text-sm text-ink-mute mt-0.5">
              {fmt(piano.data_inizio)} → {fmt(piano.data_fine)} · {piano.giorni} giorni · {piano.righe.length} farmaci
            </p>
            {piano.note && <p className="text-xs text-ink-soft mt-1 italic">{piano.note}</p>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize shrink-0 mt-1 ${CAT_COLORS[piano.categoria] ?? 'bg-bg-soft text-ink-soft border-line'}`}>
            {piano.categoria}
          </span>
        </div>

        {/* Tabella farmaci */}
        <div className="overflow-y-auto flex-1">
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-bg-soft">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 text-xs font-semibold text-ink-soft">Farmaco</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft text-center">/die</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-forest text-center">Fabbisogno</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-ink-soft text-center">Disponibile</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-abx text-center">Da ordinare</th>
                </tr>
              </thead>
              <tbody>
                {piano.righe.map((r, i) => {
                  const abx = classificaFarmaco(r.principio_attivo);
                  return (
                    <tr key={i} className={`border-b border-line/50 ${abx.isAntibiotico ? 'bg-red-50/60' : r.da_ordinare > 0 ? 'bg-abx/5' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {abx.isAntibiotico && <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <p className={`text-sm font-medium ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>
                            {r.principio_attivo}
                            {r.nome_commerciale && <span className="text-ink-mute font-normal"> · {r.nome_commerciale}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {r.dosaggio && <p className="text-xs text-ink-mute">{r.dosaggio}</p>}
                          {abx.isAntibiotico && abx.classe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">
                              {CLASSE_LABEL[abx.classe]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm tabular-nums">{r.consumo_giornaliero}</td>
                      <td className="px-3 py-2.5 text-center text-sm font-semibold text-forest tabular-nums">{r.fabbisogno}</td>
                      <td className="px-3 py-2.5 text-center text-sm tabular-nums">{r.quantita_disponibile}</td>
                      <td className="px-3 py-2.5 text-center text-sm font-bold tabular-nums">
                        {r.da_ordinare > 0 ? <span className="text-abx">{r.da_ordinare}</span> : <span className="text-forest">✓</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="sm:hidden divide-y divide-line/50">
            {piano.righe.map((r, i) => {
              const abx = classificaFarmaco(r.principio_attivo);
              return (
                <div key={i} className={`px-4 py-3 flex items-center justify-between gap-3 ${abx.isAntibiotico ? 'bg-red-50/60' : r.da_ordinare > 0 ? 'bg-abx/5' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {abx.isAntibiotico && <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <p className={`text-sm font-medium truncate ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>{r.principio_attivo}</p>
                    </div>
                    {r.dosaggio && <p className="text-xs text-ink-mute">{r.dosaggio}</p>}
                    {abx.isAntibiotico && abx.classe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">
                        {CLASSE_LABEL[abx.classe]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                    <div className="text-center"><p className="text-[10px] text-ink-mute">fabb.</p><p className="font-bold text-forest">{r.fabbisogno}</p></div>
                    <div className="text-center"><p className="text-[10px] text-ink-mute">scorte</p><p className="font-semibold">{r.quantita_disponibile}</p></div>
                    <div className="text-center w-9"><p className="text-[10px] text-ink-mute">ordine</p>
                      {r.da_ordinare > 0 ? <p className="font-bold text-abx">{r.da_ordinare}</p> : <p className="font-bold text-forest">✓</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-line flex justify-end">
          <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">Chiudi</button>
        </div>
      </div>
    </div>
  );
}

// ─── Condividi dropdown ───────────────────────────────────────────────────────
function ShareDropdown({ piano, onClose }: { piano: Piano; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function buildText() {
    const lines = [
      `Piano: ${piano.titolo}`,
      `Periodo: ${fmt(piano.data_inizio)} → ${fmt(piano.data_fine)} (${piano.giorni} gg)`,
      `Categoria: ${piano.categoria}`,
      piano.note ? `Note: ${piano.note}` : '',
      '',
      'Farmaco | /die | Fabbisogno | Disponibile | Da ordinare',
      ...piano.righe.map(r =>
        `${r.principio_attivo}${r.dosaggio ? ` ${r.dosaggio}` : ''} | ${r.consumo_giornaliero} | ${r.fabbisogno} | ${r.quantita_disponibile} | ${r.da_ordinare > 0 ? r.da_ordinare : '✓'}`
      ),
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function copyText() {
    await navigator.clipboard.writeText(buildText());
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 1500);
  }

  function shareEmail() {
    const body = encodeURIComponent(buildText());
    const subject = encodeURIComponent(`Piano fabbisogno: ${piano.titolo}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    onClose();
  }

  async function sharePDF() {
    triggerPrint(piano, 'save');
    onClose();
  }

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-40 bg-bg-card border border-line rounded-xl shadow-xl w-52 py-1 text-sm">
      <button onClick={copyText} className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors">
        {copied ? <Check className="w-4 h-4 text-forest shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
        {copied ? 'Copiato!' : 'Copia testo'}
      </button>
      <button onClick={shareEmail} className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors">
        <Mail className="w-4 h-4 shrink-0" />
        Invia per email
      </button>
      <button onClick={sharePDF} className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors">
        <FileDown className="w-4 h-4 shrink-0" />
        Scarica PDF
      </button>
    </div>
  );
}

// ─── Stampa dropdown ──────────────────────────────────────────────────────────
function PrintDropdown({ piano, onClose }: { piano: Piano; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-40 bg-bg-card border border-line rounded-xl shadow-xl w-60 py-1 text-sm">
      <p className="px-4 py-2 text-xs font-semibold text-ink-mute uppercase tracking-wide border-b border-line">Stampa</p>
      <button
        onClick={() => { triggerPrint(piano, 'all'); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors"
      >
        <Printer className="w-4 h-4 shrink-0" />
        Piano completo
      </button>
      <button
        onClick={() => { triggerPrint(piano, 'order'); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors"
      >
        <ChevronRight className="w-4 h-4 shrink-0 text-abx" />
        Solo da ordinare
      </button>
      <button
        onClick={() => { triggerPrint(piano, 'summary'); onClose(); }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors"
      >
        <ChevronRight className="w-4 h-4 shrink-0 text-forest" />
        Riepilogo scorte
      </button>
      <div className="border-t border-line mt-1 pt-1">
        <button
          onClick={() => { triggerPrint(piano, 'antibiotici'); onClose(); }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-50 text-red-700 transition-colors"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Solo antibiotici (ICA)
        </button>
      </div>
    </div>
  );
}

// ─── Funzione stampa/PDF ──────────────────────────────────────────────────────
function triggerPrint(piano: Piano, mode: 'all' | 'order' | 'summary' | 'save' | 'antibiotici') {
  const righe =
    mode === 'order' ? piano.righe.filter((r) => r.da_ordinare > 0) :
    mode === 'antibiotici' ? piano.righe.filter((r) => classificaFarmaco(r.principio_attivo).isAntibiotico) :
    piano.righe;

  const modeLabel =
    mode === 'order' ? 'Farmaci da ordinare' :
    mode === 'summary' ? 'Riepilogo scorte' :
    mode === 'antibiotici' ? 'Report Antibiotici / ICA' :
    'Piano completo';

  const isAbx = mode === 'antibiotici';

  const rows = righe.map((r) => {
    const abx = classificaFarmaco(r.principio_attivo);
    const rowBg = abx.isAntibiotico ? 'background:#fff1f2' : r.da_ordinare > 0 ? 'background:#fef2f2' : '';
    return `
    <tr style="border-bottom:1px solid #e5e7eb;${rowBg}">
      <td style="padding:8px 12px">
        ${abx.isAntibiotico ? '🛡 ' : ''}<strong style="${abx.isAntibiotico ? 'color:#b91c1c' : ''}">${r.principio_attivo}</strong>${r.nome_commerciale ? ` · <em>${r.nome_commerciale}</em>` : ''}
        ${r.dosaggio ? `<br><small style="color:#6b7280">${r.dosaggio}</small>` : ''}
        ${abx.isAntibiotico && abx.classe ? `<br><small style="color:#dc2626;font-weight:600">${CLASSE_LABEL[abx.classe]}</small>` : ''}
      </td>
      <td style="padding:8px;text-align:center">${r.consumo_giornaliero}</td>
      ${!isAbx || true ? `<td style="padding:8px;text-align:center;font-weight:600;color:#2d6a4f">${r.fabbisogno}</td>` : ''}
      <td style="padding:8px;text-align:center">${r.quantita_disponibile}</td>
      ${mode !== 'summary' ? `<td style="padding:8px;text-align:center;font-weight:700;color:${r.da_ordinare > 0 ? '#dc2626' : '#2d6a4f'}">${r.da_ordinare > 0 ? r.da_ordinare : '✓'}</td>` : ''}
    </tr>`;
  }).join('');

  const abxCount = piano.righe.filter((r) => classificaFarmaco(r.principio_attivo).isAntibiotico).length;

  const html = `<!DOCTYPE html><html lang="it"><head>
    <meta charset="UTF-8"><title>${piano.titolo} — ${modeLabel}</title>
    <style>
      body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      .meta{font-size:13px;color:#6b7280;margin-bottom:4px}
      .badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:9999px;border:1px solid #d1d5db;text-transform:capitalize;margin-bottom:16px}
      .badge-abx{display:inline-block;font-size:11px;padding:2px 8px;border-radius:9999px;border:1px solid #fca5a5;background:#fee2e2;color:#b91c1c;font-weight:600;margin-left:6px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb}
      th.c{text-align:center}
      @media print{@page{margin:1.5cm}}
    </style>
  </head><body>
    <h1>${piano.titolo}</h1>
    <p class="meta">${fmt(piano.data_inizio)} → ${fmt(piano.data_fine)} · ${piano.giorni} giorni · ${modeLabel}</p>
    ${piano.note ? `<p class="meta" style="font-style:italic">${piano.note}</p>` : ''}
    <span class="badge">${piano.categoria}</span>
    ${isAbx ? `<span class="badge-abx">🛡 ${abxCount} antibiotici</span>` : ''}
    <table>
      <thead><tr>
        <th>Farmaco</th>
        <th class="c">/die</th>
        <th class="c" style="color:#2d6a4f">Fabbisogno</th>
        <th class="c">Disponibile</th>
        ${mode !== 'summary' ? '<th class="c" style="color:#dc2626">Da ordinare</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin-top:24px">Generato il ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} — Carico Farmacia</p>
    ${mode !== 'save' ? '<script>window.onload=()=>{window.print();}<\/script>' : ''}
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ─── PianoCard ────────────────────────────────────────────────────────────────
function PianoCard({ piano, canEdit }: { piano: Piano; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [isPending, start] = useTransition();

  const daOrdinare = piano.righe.filter((r) => r.da_ordinare > 0);

  return (
    <>
      <div className="rounded-xl border border-line bg-bg-card overflow-hidden">
        {/* Header collassabile */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-soft/40 transition-colors text-left"
        >
          <Calendar className="w-4 h-4 text-ink-mute shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{piano.titolo}</p>
            <p className="text-xs text-ink-mute">
              {fmt(piano.data_inizio)} → {fmt(piano.data_fine)} · {piano.giorni} gg · {piano.righe.length} farmaci
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize shrink-0 ${CAT_COLORS[piano.categoria] ?? 'bg-bg-soft text-ink-soft border-line'}`}>
            {piano.categoria}
          </span>
          {daOrdinare.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-abx/10 text-abx border border-abx/20 font-medium shrink-0">
              {daOrdinare.length} da ordinare
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-ink-mute shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink-mute shrink-0" />}
        </button>

        {open && (
          <div className="border-t border-line">
            {piano.note && (
              <div className="px-4 py-2 bg-bg-soft/60 border-b border-line">
                <p className="text-xs text-ink-mute">{piano.note}</p>
              </div>
            )}

            {/* Desktop: tabella */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-bg-soft border-b border-line">
                    <th className="px-3 py-2 text-xs font-semibold text-ink-soft">Farmaco</th>
                    <th className="px-3 py-2 text-xs font-semibold text-ink-soft text-center">/die</th>
                    <th className="px-3 py-2 text-xs font-semibold text-forest text-center">Fabbisogno</th>
                    <th className="px-3 py-2 text-xs font-semibold text-ink-soft text-center">Disponibile</th>
                    <th className="px-3 py-2 text-xs font-semibold text-abx text-center">Da ordinare</th>
                  </tr>
                </thead>
                <tbody>
                  {piano.righe.map((r, i) => {
                    const abx = classificaFarmaco(r.principio_attivo);
                    return (
                      <tr key={i} className={`border-b border-line/50 ${abx.isAntibiotico ? 'bg-red-50/60' : r.da_ordinare > 0 ? 'bg-abx/5' : ''}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {abx.isAntibiotico && <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />}
                            <p className={`text-sm font-medium ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>
                              {r.principio_attivo}
                              {r.nome_commerciale && <span className="text-ink-mute font-normal"> · {r.nome_commerciale}</span>}
                            </p>
                            {abx.isAntibiotico && abx.classe && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">
                                {CLASSE_LABEL[abx.classe]}
                              </span>
                            )}
                          </div>
                          {r.dosaggio && <p className="text-xs text-ink-mute">{r.dosaggio}</p>}
                        </td>
                        <td className="px-3 py-2 text-center text-sm tabular-nums">{r.consumo_giornaliero}</td>
                        <td className="px-3 py-2 text-center text-sm font-semibold text-forest tabular-nums">{r.fabbisogno}</td>
                        <td className="px-3 py-2 text-center text-sm tabular-nums">{r.quantita_disponibile}</td>
                        <td className="px-3 py-2 text-center text-sm font-bold tabular-nums">
                          {r.da_ordinare > 0 ? <span className="text-abx">{r.da_ordinare}</span> : <span className="text-forest">✓</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: lista compatta */}
            <div className="sm:hidden divide-y divide-line/50">
              {piano.righe.map((r, i) => {
                const abx = classificaFarmaco(r.principio_attivo);
                return (
                  <div key={i} className={`px-4 py-3 flex items-center justify-between gap-3 ${abx.isAntibiotico ? 'bg-red-50/60' : r.da_ordinare > 0 ? 'bg-abx/5' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {abx.isAntibiotico && <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />}
                        <p className={`text-sm font-medium truncate ${abx.isAntibiotico ? 'text-red-700' : 'text-ink'}`}>{r.principio_attivo}</p>
                      </div>
                      {r.dosaggio && <p className="text-xs text-ink-mute">{r.dosaggio}</p>}
                      {abx.isAntibiotico && abx.classe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-medium">
                          {CLASSE_LABEL[abx.classe]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                      <div className="text-center"><p className="text-[10px] text-ink-mute">fabb.</p><p className="font-bold text-forest">{r.fabbisogno}</p></div>
                      <div className="text-center"><p className="text-[10px] text-ink-mute">scorte</p><p className="font-semibold">{r.quantita_disponibile}</p></div>
                      <div className="text-center w-9"><p className="text-[10px] text-ink-mute">ordine</p>
                        {r.da_ordinare > 0 ? <p className="font-bold text-abx">{r.da_ordinare}</p> : <p className="font-bold text-forest">✓</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra azioni */}
            <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2 flex-wrap">
              {/* Bottoni azioni */}
              <div className="flex items-center gap-2">
                {/* Visualizza */}
                <button
                  onClick={() => setShowDetail(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink bg-bg-soft hover:bg-bg-card border border-line px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Visualizza</span>
                </button>

                {/* Condividi */}
                <div className="relative">
                  <button
                    onClick={() => { setShowShare(!showShare); setShowPrint(false); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink bg-bg-soft hover:bg-bg-card border border-line px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Condividi</span>
                  </button>
                  {showShare && <ShareDropdown piano={piano} onClose={() => setShowShare(false)} />}
                </div>

                {/* Stampa */}
                <div className="relative">
                  <button
                    onClick={() => { setShowPrint(!showPrint); setShowShare(false); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-ink bg-bg-soft hover:bg-bg-card border border-line px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Stampa</span>
                    <ChevronDown className="w-3 h-3 hidden sm:inline" />
                  </button>
                  {showPrint && <PrintDropdown piano={piano} onClose={() => setShowPrint(false)} />}
                </div>
              </div>

              {/* Elimina */}
              {canEdit && (
                <button
                  onClick={() => {
                    if (!confirm(`Eliminare il piano "${piano.titolo}"?`)) return;
                    start(async () => { await eliminaPianoAction(piano.id); });
                  }}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-ink-mute hover:text-abx transition-colors"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Elimina</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showDetail && <PianoDetailModal piano={piano} onClose={() => setShowDetail(false)} />}
    </>
  );
}

// ─── Raggruppa per mese ───────────────────────────────────────────────────────
function raggruppaPerMese(piani: Piano[]) {
  const map = new Map<string, Piano[]>();
  for (const p of piani) {
    const key = p.data_inizio.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

function meseLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

export function CalendarioView({ piani, canEdit }: { piani: Piano[]; canEdit: boolean }) {
  const gruppi = raggruppaPerMese(piani);

  if (piani.length === 0) {
    return (
      <div className="text-center py-16 text-ink-mute">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nessun piano salvato.</p>
        <p className="text-xs mt-1">Vai su una categoria, calcola il fabbisogno e clicca "Salva nel calendario".</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {[...gruppi.entries()].map(([mese, pianiMese]) => (
        <div key={mese}>
          <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3 capitalize">
            {meseLabel(mese)}
          </h2>
          <div className="space-y-3">
            {pianiMese.map((p) => (
              <PianoCard key={p.id} piano={p} canEdit={canEdit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
