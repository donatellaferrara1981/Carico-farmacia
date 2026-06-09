'use client';

import { useState, useRef } from 'react';
import { X, Printer, FileDown, FileText, Loader2 } from 'lucide-react';
import { CLASSE_LABEL, type ClasseAntibiotico } from '@/lib/antibiotici';

export interface AbxProdotto {
  id: string;
  principio_attivo: string;
  dosaggio: string | null;
  forma_farmaceutica: string;
  quantita: number;
  consumo_giornaliero: number;
  classe: ClasseAntibiotico;
  altoCosto: boolean;
  prezzo: number | null;
  consumoPeriodo: number;
  costoPeriodo: number | null;
}

interface Props {
  prodotti: AbxProdotto[];
  dal: string;
  al: string;
  giorni: number;
  orgName: string;
  onClose: () => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildHtml(
  prodotti: AbxProdotto[],
  dal: string, al: string, giorni: number,
  reparto: string, struttura: string, operatore: string, qualifica: string, note: string,
  orgName: string,
  forDoc = false,
): string {
  const totConsumo = prodotti.reduce((s, p) => s + p.consumoPeriodo, 0);
  const totCosto = prodotti.reduce((s, p) => s + (p.costoPeriodo ?? 0), 0);
  const altoCostoN = prodotti.filter(p => p.altoCosto).length;

  const byClasse: Record<string, { n: number; consumo: number; costo: number }> = {};
  for (const p of prodotti) {
    const l = CLASSE_LABEL[p.classe];
    if (!byClasse[l]) byClasse[l] = { n: 0, consumo: 0, costo: 0 };
    byClasse[l].n++;
    byClasse[l].consumo += p.consumoPeriodo;
    byClasse[l].costo += p.costoPeriodo ?? 0;
  }

  const classeRows = Object.entries(byClasse)
    .sort((a, b) => b[1].costo - a[1].costo)
    .map(([cl, v]) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #d1d5db"><strong>${cl}</strong></td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:center">${v.n}</td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace">${v.consumo > 0 ? v.consumo : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right;font-weight:600;font-family:monospace">${v.costo > 0 ? `€ ${Math.round(v.costo).toLocaleString('it-IT')}` : '—'}</td>
      </tr>`).join('');

  const detailRows = prodotti
    .sort((a, b) => (b.costoPeriodo ?? 0) - (a.costoPeriodo ?? 0))
    .map(p => `
      <tr style="${p.altoCosto ? 'background:#fef2f2' : ''}">
        <td style="padding:5px 8px;border:1px solid #d1d5db">
          ${p.altoCosto ? `<span style="background:#fee2e2;color:#991b1b;font-size:8px;padding:1px 5px;border-radius:3px;font-weight:700;margin-right:4px;border:1px solid #fca5a5">ALTO COSTO</span>` : ''}
          <strong style="color:${p.altoCosto ? '#991b1b' : '#b91c1c'}">${p.principio_attivo}</strong>
          ${p.dosaggio ? `<span style="color:#6b7280;font-size:10px"> ${p.dosaggio}</span>` : ''}
        </td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:10px">${CLASSE_LABEL[p.classe]}</td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace">${p.consumo_giornaliero > 0 ? p.consumo_giornaliero : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right;font-weight:600;font-family:monospace">${p.consumoPeriodo > 0 ? p.consumoPeriodo : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace">${p.prezzo != null ? `€ ${p.prezzo.toLocaleString('it-IT', { minimumFractionDigits: 4 })}` : '—'}</td>
        <td style="padding:5px 8px;border:1px solid #d1d5db;text-align:right;font-weight:700;font-family:monospace;color:${p.altoCosto ? '#991b1b' : '#92400e'}">${p.costoPeriodo != null && p.costoPeriodo > 0 ? `€ ${Math.round(p.costoPeriodo).toLocaleString('it-IT')}` : '—'}</td>
      </tr>`).join('');

  const docStyle = forDoc ? `
    @page { size: A4; margin: 2cm 2cm 2.5cm 2cm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14pt; }
    th { background: #1f3d2b; color: #fff; padding: 6pt 8pt; text-align: left; font-size: 10pt; }
    h2 { font-size: 12pt; color: #1f3d2b; border-bottom: 2pt solid #1f3d2b; padding-bottom: 3pt; margin: 18pt 0 8pt; }
    .kpi-box { display: inline-block; border: 1pt solid #d1d5db; border-radius: 4pt; padding: 8pt 14pt; margin: 4pt 6pt 4pt 0; text-align: center; min-width: 80pt; }
    .kpi-val { font-size: 18pt; font-weight: 700; color: #1f3d2b; }
    .kpi-val.red { color: #991b1b; }
    .kpi-lbl { font-size: 8pt; color: #6b7280; margin-top: 2pt; }
  ` : `
    @media print {
      @page { size: A4; margin: 1.8cm; }
      body { font-size: 10pt; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; font-size: 11px; }
    th { background: #1f3d2b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    h2 { font-size: 13px; color: #1f3d2b; border-bottom: 2px solid #1f3d2b; padding-bottom: 4px; margin: 20px 0 8px; }
    .kpi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .kpi-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 14px; text-align: center; min-width: 90px; }
    .kpi-val { font-size: 20px; font-weight: 700; color: #1f3d2b; }
    .kpi-val.red { color: #991b1b; }
    .kpi-lbl { font-size: 9px; color: #6b7280; margin-top: 2px; }
  `;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Studio consumo antibiotici — ${struttura || orgName}</title>
<style>
${docStyle}
.header-box { border: 2px solid #1f3d2b; border-radius: 6px; padding: 16px 20px; margin-bottom: 20px; }
.header-logo-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
.header-title { font-size: 18px; font-weight: 700; color: #1f3d2b; letter-spacing: -0.3px; }
.header-subtitle { font-size: 12px; color: #374151; margin-top: 2px; }
.header-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-top: 10px; font-size: 11px; }
.header-meta-item { display: flex; gap: 6px; }
.header-meta-label { color: #6b7280; font-weight: 600; min-width: 90px; }
.header-meta-value { color: #111; }
.divider { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }
.footer { margin-top: 30px; border-top: 1px solid #d1d5db; padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 10px; color: #374151; }
.sign-line { border-top: 1px solid #374151; margin-top: 30px; padding-top: 4px; font-size: 10px; color: #6b7280; }
.disclaimer { margin-top: 12px; font-size: 9px; color: #9ca3af; font-style: italic; }
</style>
</head>
<body>

<!-- INTESTAZIONE -->
<div class="header-box">
  <div class="header-logo-row">
    <div>
      <div class="header-title">Studio di Consumo Antibiotici e Antivirali</div>
      <div class="header-subtitle">Analisi per periodo — uso gestionale interno</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#6b7280">
      Prodotto il ${new Date().toLocaleDateString('it-IT')}<br>
      ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>
  <hr class="divider">
  <div class="header-meta">
    <div class="header-meta-item">
      <span class="header-meta-label">Struttura:</span>
      <span class="header-meta-value">${struttura || orgName}</span>
    </div>
    <div class="header-meta-item">
      <span class="header-meta-label">Periodo:</span>
      <span class="header-meta-value"><strong>${fmt(dal)} — ${fmt(al)}</strong> (${giorni} giorni)</span>
    </div>
    <div class="header-meta-item">
      <span class="header-meta-label">U.O. / Reparto:</span>
      <span class="header-meta-value">${reparto || '—'}</span>
    </div>
    <div class="header-meta-item">
      <span class="header-meta-label">Operatore:</span>
      <span class="header-meta-value">${operatore || '—'}${qualifica ? ` (${qualifica})` : ''}</span>
    </div>
  </div>
</div>

<!-- KPI SOMMARIO -->
<div class="kpi-grid">
  <div class="kpi-box">
    <div class="kpi-val red">${prodotti.length}</div>
    <div class="kpi-lbl">Antibiotici analizzati</div>
  </div>
  <div class="kpi-box">
    <div class="kpi-val red">${altoCostoN}</div>
    <div class="kpi-lbl">Alto costo / last-resort</div>
  </div>
  <div class="kpi-box">
    <div class="kpi-val">${totConsumo > 0 ? totConsumo.toLocaleString('it-IT') : '—'}</div>
    <div class="kpi-lbl">Unità consumate (${giorni}gg)</div>
  </div>
  <div class="kpi-box" style="border-color:#991b1b">
    <div class="kpi-val red">${totCosto > 0 ? `€ ${Math.round(totCosto).toLocaleString('it-IT')}` : '—'}</div>
    <div class="kpi-lbl">Costo totale stimato</div>
  </div>
</div>

<!-- RIEPILOGO PER CLASSE -->
<h2>1. Riepilogo per classe terapeutica</h2>
<table>
  <thead>
    <tr>
      <th>Classe terapeutica (ATC)</th>
      <th style="text-align:center;width:80px">N° farmaci</th>
      <th style="text-align:right;width:120px">Consumo periodo</th>
      <th style="text-align:right;width:130px">Costo stimato</th>
    </tr>
  </thead>
  <tbody>${classeRows}</tbody>
  <tfoot>
    <tr style="background:#f9fafb;font-weight:700">
      <td style="padding:6px 8px;border:1px solid #d1d5db">TOTALE</td>
      <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:center">${prodotti.length}</td>
      <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace">${totConsumo > 0 ? totConsumo.toLocaleString('it-IT') : '—'}</td>
      <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace;color:#991b1b">${totCosto > 0 ? `€ ${Math.round(totCosto).toLocaleString('it-IT')}` : '—'}</td>
    </tr>
  </tfoot>
</table>

<!-- DETTAGLIO PER PRINCIPIO ATTIVO -->
<h2>2. Dettaglio per principio attivo</h2>
<table>
  <thead>
    <tr>
      <th>Principio attivo</th>
      <th style="font-size:9px">Classe</th>
      <th style="text-align:right;width:75px">Cons./die</th>
      <th style="text-align:right;width:90px">Cons. ${giorni}gg</th>
      <th style="text-align:right;width:90px">Prezzo unit.</th>
      <th style="text-align:right;width:100px">Costo periodo</th>
    </tr>
  </thead>
  <tbody>${detailRows}</tbody>
  <tfoot>
    <tr style="background:#fff1f2;font-weight:700">
      <td colspan="3" style="padding:6px 8px;border:1px solid #d1d5db;color:#991b1b">TOTALE PERIODO</td>
      <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace">${totConsumo > 0 ? totConsumo.toLocaleString('it-IT') : '—'}</td>
      <td style="padding:6px 8px;border:1px solid #d1d5db"></td>
      <td style="padding:6px 8px;border:1px solid #d1d5db;text-align:right;font-family:monospace;color:#991b1b">${totCosto > 0 ? `€ ${Math.round(totCosto).toLocaleString('it-IT')}` : '—'}</td>
    </tr>
  </tfoot>
</table>

${note ? `<h2>3. Note</h2><p style="font-size:11px;color:#374151;white-space:pre-wrap">${note}</p>` : ''}

<!-- FOOTER / FIRME -->
<div class="footer">
  <div>
    <p style="margin:0 0 4px;font-weight:600">Prodotto da</p>
    <p style="margin:0">${operatore || '—'}${qualifica ? ` — ${qualifica}` : ''}</p>
    <p style="margin:0">${reparto || ''}</p>
    <div class="sign-line">Firma</div>
  </div>
  <div>
    <p style="margin:0 0 4px;font-weight:600">Visto / Responsabile</p>
    <p style="margin:0">&nbsp;</p>
    <p style="margin:0">&nbsp;</p>
    <div class="sign-line">Firma</div>
  </div>
</div>

<p class="disclaimer">
  * Il consumo è calcolato come: consumo/die × ${giorni} giorni. Il costo è stimato sulla base dei prezzi presenti nelle gare d'appalto registrate nel sistema.
  Dati a scopo gestionale interno — non sostituisce la documentazione farmaceutica ufficiale.
</p>

</body>
</html>`;
}

export function RelazioneAntibioticiModal({ prodotti, dal, al, giorni, orgName, onClose }: Props) {
  const [reparto, setReparto] = useState('');
  const [struttura, setStruttura] = useState(orgName);
  const [operatore, setOperatore] = useState('');
  const [qualifica, setQualifica] = useState('');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);

  function stampa() {
    setGenerating(true);
    setTimeout(() => {
      const html = buildHtml(prodotti, dal, al, giorni, reparto, struttura, operatore, qualifica, note, orgName, false);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      w?.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url); });
      setGenerating(false);
    }, 50);
  }

  function scaricaPdf() {
    setGenerating(true);
    setTimeout(() => {
      const html = buildHtml(prodotti, dal, al, giorni, reparto, struttura, operatore, qualifica, note, orgName, false);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        w.addEventListener('load', () => {
          w.print();
          URL.revokeObjectURL(url);
        });
      }
      setGenerating(false);
    }, 50);
  }

  function scaricaDoc() {
    setGenerating(true);
    setTimeout(() => {
      const html = buildHtml(prodotti, dal, al, giorni, reparto, struttura, operatore, qualifica, note, orgName, true);
      const blob = new Blob(['﻿' + html], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nome = `studio_antibiotici_${dal}_${al}.doc`;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      setGenerating(false);
    }, 50);
  }

  function fmt2(iso: string) { return new Date(iso).toLocaleDateString('it-IT'); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-bg-card rounded-2xl shadow-2xl border border-line w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <div>
            <p className="font-semibold text-ink">Genera relazione</p>
            <p className="text-xs text-ink-mute mt-0.5">
              Studio antibiotici · {fmt2(dal)} — {fmt2(al)} · {giorni} giorni
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-mute">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Struttura / Ospedale</label>
              <input
                type="text"
                value={struttura}
                onChange={e => setStruttura(e.target.value)}
                className="input-base text-sm"
                placeholder={orgName}
              />
            </div>
            <div>
              <label className="label-xs">U.O. / Reparto</label>
              <input
                type="text"
                value={reparto}
                onChange={e => setReparto(e.target.value)}
                className="input-base text-sm"
                placeholder="es. Farmacia, GCA3, Neuroriabilitazione…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Nome operatore</label>
              <input
                type="text"
                value={operatore}
                onChange={e => setOperatore(e.target.value)}
                className="input-base text-sm"
                placeholder="Nome Cognome"
              />
            </div>
            <div>
              <label className="label-xs">Qualifica</label>
              <input
                type="text"
                value={qualifica}
                onChange={e => setQualifica(e.target.value)}
                className="input-base text-sm"
                placeholder="es. Farmacista, Dirigente…"
              />
            </div>
          </div>

          <div>
            <label className="label-xs">Note aggiuntive (opzionale)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="input-base text-sm resize-none"
              placeholder="Osservazioni, limitazioni dello studio, raccomandazioni…"
            />
          </div>

          {/* Anteprima contenuto */}
          <div className="rounded-lg border border-line bg-bg-soft px-4 py-3 text-xs text-ink-soft space-y-1">
            <p className="font-semibold text-ink text-xs mb-2">Contenuto della relazione</p>
            <p>✓ Intestazione con struttura, reparto, operatore e periodo</p>
            <p>✓ Riepilogo KPI (antibiotici, alto costo, unità consumate, costo totale)</p>
            <p>✓ Tabella riepilogativa per classe terapeutica (ATC)</p>
            <p>✓ Dettaglio per principio attivo con consumo e costo periodo</p>
            <p>✓ Spazio firma operatore e responsabile</p>
            <p>✓ Disclaimer metodologico</p>
            <p className="text-ink-mute mt-1">
              {prodotti.length} farmaci · {prodotti.filter(p => p.altoCosto).length} alto costo ·{' '}
              {prodotti.filter(p => p.costoPeriodo != null && p.costoPeriodo > 0).length} con prezzo da gara
            </p>
          </div>
        </div>

        {/* Azioni */}
        <div className="px-6 py-4 border-t border-line shrink-0 flex flex-wrap gap-2 justify-between items-center">
          <button onClick={onClose} className="btn-ghost text-sm">Annulla</button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={scaricaDoc}
              disabled={generating}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Scarica DOC
            </button>
            <button
              onClick={stampa}
              disabled={generating}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Stampa / PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
