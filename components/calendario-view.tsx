'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Trash2, Loader2, Calendar, Share2, Printer } from 'lucide-react';
import { eliminaPianoAction } from '@/app/(app)/[categoria]/piani-actions';
import type { RigaPiano } from '@/app/(app)/[categoria]/piani-actions';

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

function pianoToText(piano: Piano): string {
  const header = `${piano.titolo}\n${fmt(piano.data_inizio)} → ${fmt(piano.data_fine)} (${piano.giorni} giorni)\nCategoria: ${piano.categoria}\n`;
  const note = piano.note ? `Note: ${piano.note}\n` : '';
  const sep = '─'.repeat(60) + '\n';
  const cols = 'Farmaco                              /die  Fabb  Disp  Ord\n';
  const rows = piano.righe.map((r) => {
    const nome = `${r.principio_attivo}${r.dosaggio ? ` ${r.dosaggio}` : ''}`.slice(0, 36).padEnd(36);
    return `${nome} ${String(r.consumo_giornaliero).padStart(4)}  ${String(r.fabbisogno).padStart(4)}  ${String(r.quantita_disponibile).padStart(4)}  ${r.da_ordinare > 0 ? String(r.da_ordinare).padStart(3) : '  ✓'}`;
  }).join('\n');
  return `${header}${note}${sep}${cols}${sep}${rows}`;
}

function stampaPiano(piano: Piano) {
  const righe = piano.righe.map((r) => `<tr style="${r.da_ordinare > 0 ? 'background:#fff0f0' : ''}">
    <td>${r.principio_attivo}${r.nome_commerciale ? ` <span style="color:#6b7280">· ${r.nome_commerciale}</span>` : ''}${r.dosaggio ? ` <span style="color:#9ca3af;font-size:10px">${r.dosaggio}</span>` : ''}</td>
    <td>${r.consumo_giornaliero}</td>
    <td style="font-weight:700;color:#166534">${r.fabbisogno}</td>
    <td>${r.quantita_disponibile}</td>
    <td style="font-weight:700;color:${r.da_ordinare > 0 ? '#dc2626' : '#166534'}">${r.da_ordinare > 0 ? r.da_ordinare : '✓'}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>${piano.titolo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:12px}
    h1{font-size:13px;font-weight:700;margin-bottom:2px}
    .sub{font-size:10px;color:#6b7280;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th{background:#f3f4f6;font-size:10px;font-weight:600;text-align:center;padding:4px 6px;border:1px solid #d1d5db}
    th:first-child{text-align:left}
    td{font-size:11px;padding:3px 6px;border:1px solid #e5e7eb;vertical-align:middle;text-align:center}
    td:first-child{text-align:left}
    tr:nth-child(even){background:#fafafa}
    @media print{@page{size:A4;margin:1cm}body{padding:0}}
  </style></head><body>
  <h1>${piano.titolo}</h1>
  <div class="sub">${fmt(piano.data_inizio)} → ${fmt(piano.data_fine)} · ${piano.giorni} giorni · ${piano.categoria}${piano.note ? ' · ' + piano.note : ''}</div>
  <table><thead><tr>
    <th>Farmaco</th><th>/die</th><th>Fabbisogno</th><th>Disponibile</th><th>Da ordinare</th>
  </tr></thead><tbody>${righe}</tbody></table>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const w    = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    return;
  }
  w.addEventListener('load', () => {
    w.print();
    URL.revokeObjectURL(url);
  });
}

function PianoCard({ piano, canEdit }: { piano: Piano; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();

  const daOrdinare = piano.righe.filter((r) => r.da_ordinare > 0);

  return (
    <div className="rounded-xl border border-line bg-bg-card overflow-hidden">
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

          <div className="overflow-x-auto">
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
                {piano.righe.map((r, i) => (
                  <tr key={i} className={`border-b border-line/50 ${r.da_ordinare > 0 ? 'bg-abx/5' : ''}`}>
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium text-ink leading-tight">
                        {r.principio_attivo}
                        {r.nome_commerciale && <span className="text-ink-mute font-normal"> · {r.nome_commerciale}</span>}
                      </p>
                      {r.dosaggio && <p className="text-xs text-ink-mute">{r.dosaggio}</p>}
                    </td>
                    <td className="px-3 py-2 text-center text-sm tabular-nums">{r.consumo_giornaliero}</td>
                    <td className="px-3 py-2 text-center text-sm font-semibold text-forest tabular-nums">{r.fabbisogno}</td>
                    <td className="px-3 py-2 text-center text-sm tabular-nums">{r.quantita_disponibile}</td>
                    <td className="px-3 py-2 text-center text-sm font-bold tabular-nums">
                      {r.da_ordinare > 0
                        ? <span className="text-abx">{r.da_ordinare}</span>
                        : <span className="text-forest">✓</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const testo = pianoToText(piano);
                  if (navigator.share) {
                    try { await navigator.share({ title: piano.titolo, text: testo }); } catch { /* annullato */ }
                  } else {
                    await navigator.clipboard.writeText(testo);
                    alert('Testo copiato negli appunti');
                  }
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 text-ink-soft hover:text-forest transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Condividi
              </button>
              <button
                onClick={() => stampaPiano(piano)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 text-ink-soft hover:text-forest transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Stampa
              </button>
            </div>
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
                Elimina piano
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Raggruppa per mese
function raggruppaPerMese(piani: Piano[]) {
  const map = new Map<string, Piano[]>();
  for (const p of piani) {
    const key = p.data_inizio.slice(0, 7); // YYYY-MM
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
