'use client';

import { useEffect, useRef, useState } from 'react';
import { Printer, Save, FileText, FileType, ChevronDown } from 'lucide-react';
import type { ProdottoConDocumenti } from '@/lib/prodotti';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTableHtml(prodotti: ProdottoConDocumenti[], titolo: string): string {
  const dataOggi = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const righe = prodotti
    .map((p, i) => {
      const media = p.consumo_medio != null ? Number(p.consumo_medio) : '';
      const scorsa = p.quantita_consegnata ?? '';
      const sett = Number(p.consumo_giornaliero ?? 0) || '';
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="art">${escapeHtml(p.principio_attivo)}</td>
        <td class="cod">${escapeHtml(p.nome_commerciale ?? '')}</td>
        <td class="ctr">${media}</td>
        <td class="ctr">${scorsa}</td>
        <td class="ctr">${sett}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titolo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #1a2421; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #1f4d3a; }
  .meta { font-size: 12px; color: #5a6b63; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th {
    background: #1f4d3a; color: #fff; text-align: left; padding: 6px 8px;
    font-weight: 600; border: 1px solid #1f4d3a;
  }
  th.ctr, td.ctr { text-align: center; }
  tbody td { padding: 4px 8px; border: 1px solid #d4ddd8; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f3f7f5; }
  td.num { width: 32px; text-align: center; color: #7a8a82; }
  td.art { font-weight: 600; }
  td.cod { color: #5a6b63; font-size: 10px; }
  th.ctr, td.ctr { width: 70px; }
  .footer { margin-top: 16px; font-size: 10px; color: #9aa7a0; text-align: right; }
  @media print {
    body { margin: 12mm; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(titolo)}</h1>
  <div class="meta">Elenco aggiornato al ${dataOggi} &middot; ${prodotti.length} articoli</div>
  <table>
    <thead>
      <tr>
        <th class="ctr">#</th>
        <th>Articolo</th>
        <th>Codice / marca</th>
        <th class="ctr">Media</th>
        <th class="ctr">Sett. scorsa</th>
        <th class="ctr">Questa sett.</th>
      </tr>
    </thead>
    <tbody>
      ${righe}
    </tbody>
  </table>
  <div class="footer">Gestionale Infermieristico &middot; generato il ${dataOggi}</div>
</body>
</html>`;
}

export function SanitarioExport({
  prodotti,
  titolo = 'Materiale Sanitario',
}: {
  prodotti: ProdottoConDocumenti[];
  titolo?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  function stampa() {
    const html = buildTableHtml(prodotti, titolo);
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    // attende il render prima di stampare
    setTimeout(() => w.print(), 350);
  }

  function scaricaPdf() {
    // Il PDF si ottiene dal dialogo di stampa → "Salva come PDF"
    setMenuOpen(false);
    stampa();
  }

  function scaricaWord() {
    setMenuOpen(false);
    const html = buildTableHtml(prodotti, titolo);
    const docHtml =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
      `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
      html.replace(/^<!DOCTYPE html>/, '').replace(/^<html lang="it">/, '');
    const blob = new Blob(['﻿', docHtml], { type: 'application/msword' });
    scaricaBlob(blob, `${titolo.replace(/\s+/g, '_')}.doc`);
  }

  function scaricaBlob(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (prodotti.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {/* Stampa */}
      <button
        onClick={stampa}
        title="Stampa elenco"
        className="flex items-center justify-center w-7 h-7 rounded-md border border-line text-ink-soft hover:text-forest hover:border-forest/50 transition-colors"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>

      {/* Salva (PDF / Word) */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title="Salva elenco"
          className="flex items-center gap-0.5 justify-center h-7 px-1.5 rounded-md border border-line text-ink-soft hover:text-forest hover:border-forest/50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 z-20 w-44 rounded-lg border border-line bg-bg-card shadow-lg overflow-hidden">
            <button
              onClick={scaricaPdf}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-ink-soft hover:bg-bg-soft text-left"
            >
              <FileText className="w-3.5 h-3.5 text-red-500" />
              Salva come PDF
            </button>
            <button
              onClick={scaricaWord}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-ink-soft hover:bg-bg-soft text-left border-t border-line/60"
            >
              <FileType className="w-3.5 h-3.5 text-blue-600" />
              Salva come Word
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
