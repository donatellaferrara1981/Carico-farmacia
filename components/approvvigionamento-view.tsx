'use client';

import { useState, useMemo } from 'react';
import { Printer, Download, ClipboardCopy, Check } from 'lucide-react';
import { formaLabel, type Prodotto } from '@/lib/prodotti';
import { CAT_LABELS, type CategoriaArticolo } from '@/lib/types';

interface RigaOrdine {
  id: string;
  categoria: CategoriaArticolo;
  principio_attivo: string;
  forma_farmaceutica: string;
  dosaggio: string | null;
  scorta_attuale: number;
  consumo_giornaliero: number;
  fabbisogno: number;
  da_ordinare: number;
  note: string | null;
}

function calcolaOrdini(prodotti: Prodotto[], giorni: number): RigaOrdine[] {
  return prodotti
    .filter((p) => p.consumo_giornaliero > 0)
    .map((p) => {
      const fabbisogno = Math.ceil(p.consumo_giornaliero * giorni);
      const da_ordinare = Math.max(0, fabbisogno - p.quantita);
      return {
        id: p.id,
        categoria: p.categoria as CategoriaArticolo,
        principio_attivo: p.principio_attivo,
        forma_farmaceutica: p.forma_farmaceutica,
        dosaggio: p.dosaggio,
        scorta_attuale: p.quantita,
        consumo_giornaliero: p.consumo_giornaliero,
        fabbisogno,
        da_ordinare,
        note: p.note,
      };
    })
    .filter((r) => r.da_ordinare > 0)
    .sort((a, b) => a.principio_attivo.localeCompare(b.principio_attivo));
}

function exportCSV(righe: RigaOrdine[], giorni: number, orgName: string) {
  const header = ['Categoria', 'Principio attivo', 'Forma', 'Dosaggio', 'Scorta attuale', 'Consumo/die', `Fabbisogno ${giorni}gg`, 'Da ordinare', 'Note'];
  const rows = righe.map((r) => [
    CAT_LABELS[r.categoria],
    r.principio_attivo,
    formaLabel(r.forma_farmaceutica),
    r.dosaggio ?? '',
    r.scorta_attuale,
    r.consumo_giornaliero,
    r.fabbisogno,
    r.da_ordinare,
    r.note ?? '',
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `approvvigionamento_${giorni}gg_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyText(righe: RigaOrdine[], giorni: number) {
  const lines = [`📋 Approvvigionamento ${giorni} giorni — ${new Date().toLocaleDateString('it-IT')}`, ''];
  let lastCat = '';
  for (const r of righe) {
    const cat = CAT_LABELS[r.categoria];
    if (cat !== lastCat) { lines.push(`\n▪ ${cat.toUpperCase()}`); lastCat = cat; }
    lines.push(`  • ${r.principio_attivo}${r.dosaggio ? ` ${r.dosaggio}` : ''} (${formaLabel(r.forma_farmaceutica)}) → ${r.da_ordinare} pz`);
  }
  navigator.clipboard.writeText(lines.join('\n'));
}

export function ApprovvigionamentoView({ prodotti, orgName }: { prodotti: Prodotto[]; orgName: string }) {
  const [giorni, setGiorni] = useState<7 | 14 | 'custom'>(7);
  const [custom, setCustom] = useState(21);
  const [soloMancanti, setSoloMancanti] = useState(false);
  const [copied, setCopied] = useState(false);

  const giorniEffettivi = giorni === 'custom' ? custom : giorni;
  const righe = useMemo(() => calcolaOrdini(prodotti, giorniEffettivi), [prodotti, giorniEffettivi]);
  const tutteLeRighe = useMemo(() => prodotti
    .filter((p) => p.consumo_giornaliero > 0)
    .map((p) => {
      const fabbisogno = Math.ceil(p.consumo_giornaliero * giorniEffettivi);
      return {
        id: p.id,
        categoria: p.categoria as CategoriaArticolo,
        principio_attivo: p.principio_attivo,
        forma_farmaceutica: p.forma_farmaceutica,
        dosaggio: p.dosaggio,
        scorta_attuale: p.quantita,
        consumo_giornaliero: p.consumo_giornaliero,
        fabbisogno,
        da_ordinare: Math.max(0, fabbisogno - p.quantita),
        note: p.note,
      };
    })
    .sort((a, b) => a.principio_attivo.localeCompare(b.principio_attivo)),
  [prodotti, giorniEffettivi]);
  const righeVis = soloMancanti ? righe : tutteLeRighe;

  const senzaConsumo = prodotti.filter((p) => p.consumo_giornaliero === 0).length;

  function handleCopy() {
    copyText(righe, giorniEffettivi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Controlli periodo */}
      <div className="card">
        <p className="text-sm font-medium text-ink mb-3">Periodo di approvvigionamento</p>
        <div className="flex flex-wrap gap-2">
          {([7, 14] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGiorni(g)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                giorni === g
                  ? 'bg-forest text-white border-forest'
                  : 'border-line text-ink-soft hover:border-forest/40 hover:text-ink'
              }`}
            >
              {g} giorni
            </button>
          ))}
          <button
            onClick={() => setGiorni('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              giorni === 'custom'
                ? 'bg-forest text-white border-forest'
                : 'border-line text-ink-soft hover:border-forest/40 hover:text-ink'
            }`}
          >
            Personalizzato
          </button>
          {giorni === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={custom}
                onChange={(e) => setCustom(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-base w-20 text-center"
              />
              <span className="text-sm text-ink-soft">giorni</span>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={soloMancanti}
            onChange={(e) => setSoloMancanti(e.target.checked)}
            className="w-4 h-4 accent-forest"
          />
          <span className="text-sm text-ink-soft">Mostra solo prodotti da ordinare</span>
        </label>
      </div>

      {/* Avviso prodotti senza consumo */}
      {senzaConsumo > 0 && (
        <div className="px-4 py-3 rounded-lg bg-amber/10 border border-amber/30 text-sm text-amber-700">
          <strong>{senzaConsumo} prodott{senzaConsumo === 1 ? 'o' : 'i'}</strong> senza consumo/die impostato — non inclus{senzaConsumo === 1 ? 'o' : 'i'} nel calcolo. Modifica i prodotti per aggiungere il consumo giornaliero.
        </div>
      )}

      {/* Pulsanti azioni */}
      {righeVis.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-end print:hidden">
          <button onClick={handleCopy} className="btn-ghost">
            {copied ? <Check className="w-4 h-4 text-forest" /> : <ClipboardCopy className="w-4 h-4" />}
            {copied ? 'Copiato!' : 'Copia testo'}
          </button>
          <button onClick={() => exportCSV(righeVis, giorniEffettivi, orgName)} className="btn-ghost">
            <Download className="w-4 h-4" />
            Scarica CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary">
            <Printer className="w-4 h-4" />
            Stampa / PDF
          </button>
        </div>
      )}

      {/* Intestazione stampa */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">{orgName}</h1>
        <p className="text-gray-600">Lista approvvigionamento — {giorniEffettivi} giorni — {new Date().toLocaleDateString('it-IT')}</p>
      </div>

      {/* Tabella */}
      {righeVis.length === 0 ? (
        <div className="text-center py-16 text-ink-mute">
          <p className="text-sm">Nessun prodotto da ordinare per questo periodo.</p>
          <p className="text-xs mt-1">Aggiungi il consumo giornaliero ai tuoi prodotti per calcolare il fabbisogno.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-soft border-b border-line text-left">
                <th className="px-4 py-3 font-medium text-ink-soft">Principio attivo</th>
                <th className="px-4 py-3 font-medium text-ink-soft">Forma / Dosaggio</th>
                <th className="px-4 py-3 font-medium text-ink-soft text-right">Scorta</th>
                <th className="px-4 py-3 font-medium text-ink-soft text-right">Fabbisogno</th>
                <th className="px-4 py-3 font-medium text-ink-soft text-right bg-forest/5">Da ordinare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {righeVis.map((r) => (
                <tr key={r.id} className={r.da_ordinare > 0 ? 'bg-bg-card' : 'bg-bg opacity-60'}>
                  <td className="px-4 py-3 font-medium text-ink">{r.principio_attivo}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formaLabel(r.forma_farmaceutica)}
                    {r.dosaggio && <span className="ml-1 text-xs text-ink-mute">{r.dosaggio}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={r.scorta_attuale === 0 ? 'text-abx font-semibold' : r.scorta_attuale <= 3 ? 'text-amber font-semibold' : 'text-ink'}>
                      {r.scorta_attuale}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{r.fabbisogno}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold bg-forest/5">
                    {r.da_ordinare > 0 ? (
                      <span className="text-forest">{r.da_ordinare}</span>
                    ) : (
                      <span className="text-ink-mute text-xs">✓ ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
