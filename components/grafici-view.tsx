'use client';

import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formaLabel } from '@/lib/prodotti';
import { CAT_LABELS, type CategoriaArticolo } from '@/lib/types';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';
import { classificaFarmaco, isAltoCosto, CLASSE_LABEL, type ClasseAntibiotico } from '@/lib/antibiotici';
import { RelazioneAntibioticiModal, type AbxProdotto } from '@/components/relazione-antibiotici-modal';

// Palette colori
const COLORS = ['#1f3d2b','#2d5a3d','#b8842a','#c0392b','#4a7c59','#e8a838','#6b9e7a','#d4956a'];

interface Prodotto {
  id: string;
  categoria: string;
  principio_attivo: string;
  forma_farmaceutica: string;
  dosaggio: string | null;
  quantita: number;
  consumo_giornaliero: number;
  unita_operativa_id: string | null;
}

interface Gara {
  id: string;
  descrizione: string;
  prezzo_unitario: number | null;
  unita_misura: string | null;
}
interface Documento {
  id: string;
  nome_file: string;
  categoria: string;
  created_at: string;
  turno: string | null;
  data_riferimento: string | null;
  unita_operativa_id: string | null;
}
interface UnitaOperativa { id: string; nome: string; }

interface TerapiaIca { id: string; principio_attivo: string; dosaggio: string | null; posologia: string | null; paziente_id: string; }
interface PazienteIca { id: string; nominativo: string; sala: string; numero_letto: number; piano: string | null; }

type TipoGrafico = 'barre' | 'linea' | 'torta' | 'gantt' | 'scorte' | 'consumo' | 'antibiotici' | 'ica';

const TABS: { id: TipoGrafico; label: string }[] = [
  { id: 'scorte',       label: 'Scorte' },
  { id: 'consumo',      label: 'Consumo/die' },
  { id: 'antibiotici',  label: '🦠 Antibiotici' },
  { id: 'ica',          label: '🏥 ICA' },
  { id: 'barre',        label: 'Per categoria' },
  { id: 'torta',        label: 'Distribuzione forme' },
  { id: 'linea',        label: 'Caricamenti nel tempo' },
  { id: 'gantt',        label: 'Gantt turni' },
];

export function GraficiView({ prodotti, documenti, unita, gare = [], orgName = '', terapiePazienti = [], pazientiIca = [] }: {
  prodotti: Prodotto[];
  documenti: Documento[];
  unita: UnitaOperativa[];
  gare?: Gara[];
  orgName?: string;
  terapiePazienti?: TerapiaIca[];
  pazientiIca?: PazienteIca[];
}) {
  const [tab, setTab] = useState<TipoGrafico>('scorte');

  function testoTabella() {
    if (tab === 'scorte') {
      const righe = prodotti.filter(p => p.quantita >= 0).sort((a,b) => a.quantita - b.quantita).slice(0,20);
      return `📊 Scorte attuali\n${righe.map(p => `• ${p.principio_attivo}${p.dosaggio ? ' ' + p.dosaggio : ''}: ${p.quantita} pz`).join('\n')}`;
    }
    if (tab === 'consumo') {
      const righe = prodotti.filter(p => p.consumo_giornaliero > 0).sort((a,b) => b.consumo_giornaliero - a.consumo_giornaliero).slice(0,20);
      return `📊 Consumo giornaliero\n${righe.map(p => `• ${p.principio_attivo}${p.dosaggio ? ' ' + p.dosaggio : ''}: ${p.consumo_giornaliero} pz/die`).join('\n')}`;
    }
    const bycat = Object.entries(
      prodotti.reduce<Record<string, number>>((acc, p) => { acc[p.categoria] = (acc[p.categoria] ?? 0) + p.quantita; return acc; }, {})
    );
    return `📊 Distribuzione prodotti\n${bycat.map(([c, v]) => `• ${CAT_LABELS[c as CategoriaArticolo] ?? c}: ${v} pz`).join('\n')}`;
  }

  function htmlTabella() {
    const titolo = TABS.find(t => t.id === tab)?.label ?? 'Grafici';
    let corpo = '';
    if (tab === 'scorte') {
      const righe = prodotti.filter(p => p.quantita >= 0).sort((a,b) => a.quantita - b.quantita).slice(0,20);
      corpo = `<table><thead><tr><th>Principio attivo</th><th>Forma</th><th class="num">Scorta</th></tr></thead><tbody>${righe.map(p => `<tr><td>${p.principio_attivo}${p.dosaggio ? ' ' + p.dosaggio : ''}</td><td>${formaLabel(p.forma_farmaceutica)}</td><td class="num ${p.quantita === 0 ? 'red' : ''}">${p.quantita}</td></tr>`).join('')}</tbody></table>`;
    } else if (tab === 'consumo') {
      const righe = prodotti.filter(p => p.consumo_giornaliero > 0).sort((a,b) => b.consumo_giornaliero - a.consumo_giornaliero).slice(0,20);
      corpo = `<table><thead><tr><th>Principio attivo</th><th>Forma</th><th class="num">Consumo/die</th></tr></thead><tbody>${righe.map(p => `<tr><td>${p.principio_attivo}${p.dosaggio ? ' ' + p.dosaggio : ''}</td><td>${formaLabel(p.forma_farmaceutica)}</td><td class="num">${p.consumo_giornaliero}</td></tr>`).join('')}</tbody></table>`;
    } else {
      const bycat = Object.entries(prodotti.reduce<Record<string, number>>((acc, p) => { acc[p.categoria] = (acc[p.categoria] ?? 0) + p.quantita; return acc; }, {}));
      corpo = `<table><thead><tr><th>Categoria</th><th class="num">Quantità totale</th></tr></thead><tbody>${bycat.map(([c, v]) => `<tr><td>${CAT_LABELS[c as CategoriaArticolo] ?? c}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table>`;
    }
    return htmlBase(titolo, new Date().toLocaleDateString('it-IT'), corpo);
  }

  return (
    <div className="space-y-6">
      {/* Tab selector + Share */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              tab === t.id
                ? 'bg-forest text-white border-forest'
                : 'border-line text-ink-soft hover:border-forest/40 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>
        <SharePrintBar
          titolo={TABS.find(t => t.id === tab)?.label ?? 'Grafici'}
          testoCondivisione={testoTabella}
          generaHtml={htmlTabella}
        />
      </div>

      <div className="card">
        {tab === 'scorte'      && <GraficoScorte prodotti={prodotti} />}
        {tab === 'consumo'     && <GraficoConsumo prodotti={prodotti} />}
        {tab === 'antibiotici' && <StudioAntibiotici prodotti={prodotti} gare={gare} orgName={orgName} />}
        {tab === 'ica'         && <StudioIca terapie={terapiePazienti} pazienti={pazientiIca} orgName={orgName} />}
        {tab === 'barre'       && <GraficoCategorie prodotti={prodotti} />}
        {tab === 'torta'       && <GraficoForme prodotti={prodotti} />}
        {tab === 'linea'       && <GraficoCaricamenti documenti={documenti} />}
        {tab === 'gantt'       && <GraficoGantt documenti={documenti} unita={unita} />}
      </div>
    </div>
  );
}

/* ── Scorte per prodotto ── */
function GraficoScorte({ prodotti }: { prodotti: Prodotto[] }) {
  const dati = prodotti
    .filter((p) => p.quantita >= 0)
    .sort((a, b) => a.quantita - b.quantita)
    .slice(0, 20)
    .map((p) => ({
      nome: `${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''}`,
      scorta: p.quantita,
      fill: p.quantita === 0 ? '#c0392b' : p.quantita <= 3 ? '#b8842a' : '#1f3d2b',
    }));

  if (!dati.length) return <Empty />;
  return (
    <>
      <h3 className="font-semibold text-ink mb-4">Scorte attuali (rosso=esaurito, ambra=basso)</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, dati.length * 28)}>
        <BarChart data={dati} layout="vertical" margin={{ left: 20, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v} pz`, 'Scorta']} />
          <Bar dataKey="scorta" radius={[0, 4, 4, 0]}>
            {dati.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/* ── Consumo giornaliero ── */
function GraficoConsumo({ prodotti }: { prodotti: Prodotto[] }) {
  const dati = prodotti
    .filter((p) => p.consumo_giornaliero > 0)
    .sort((a, b) => b.consumo_giornaliero - a.consumo_giornaliero)
    .slice(0, 20)
    .map((p) => ({
      nome: `${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''}`,
      consumo: p.consumo_giornaliero,
    }));

  if (!dati.length) return <Empty msg="Imposta il consumo/die sui prodotti per visualizzare questo grafico." />;
  return (
    <>
      <h3 className="font-semibold text-ink mb-4">Consumo giornaliero (pz/die)</h3>
      <ResponsiveContainer width="100%" height={Math.max(300, dati.length * 28)}>
        <BarChart data={dati} layout="vertical" margin={{ left: 20, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v} pz/die`, 'Consumo']} />
          <Bar dataKey="consumo" fill="#2d5a3d" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/* ── Prodotti per categoria ── */
function GraficoCategorie({ prodotti }: { prodotti: Prodotto[] }) {
  const cats = ['terapie', 'nutrizioni', 'sanitario'] as CategoriaArticolo[];
  const dati = cats.map((cat) => ({
    categoria: CAT_LABELS[cat],
    prodotti: prodotti.filter((p) => p.categoria === cat).length,
    esauriti: prodotti.filter((p) => p.categoria === cat && p.quantita === 0).length,
  }));

  return (
    <>
      <h3 className="font-semibold text-ink mb-4">Prodotti per categoria</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dati} margin={{ bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="categoria" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="prodotti" name="Totale" fill="#1f3d2b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="esauriti" name="Esauriti" fill="#c0392b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/* ── Distribuzione forme farmaceutiche ── */
function GraficoForme({ prodotti }: { prodotti: Prodotto[] }) {
  const map = new Map<string, number>();
  for (const p of prodotti) {
    const label = formaLabel(p.forma_farmaceutica);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  const dati = [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  if (!dati.length) return <Empty />;
  return (
    <>
      <h3 className="font-semibold text-ink mb-4">Distribuzione forme farmaceutiche</h3>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={dati} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(props: { name?: string; percent?: number }) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
            {dati.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} prodotti`, n]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </>
  );
}

/* ── Caricamenti documenti nel tempo ── */
function GraficoCaricamenti({ documenti }: { documenti: Documento[] }) {
  const map = new Map<string, number>();
  for (const d of documenti) {
    const data = d.created_at.slice(0, 10);
    map.set(data, (map.get(data) ?? 0) + 1);
  }
  const dati = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([data, n]) => ({ data: data.slice(5), n }));

  if (!dati.length) return <Empty msg="Nessun documento caricato ancora." />;
  return (
    <>
      <h3 className="font-semibold text-ink mb-4">Documenti caricati (ultimi 30 giorni)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dati} margin={{ bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="data" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(v) => [`${v}`, 'Documenti']} />
          <Line type="monotone" dataKey="n" stroke="#1f3d2b" strokeWidth={2} dot={{ fill: '#1f3d2b', r: 4 }} name="Documenti" />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

/* ── Gantt turni ── */
const TURNI = ['mattino', 'pomeriggio', 'notte'] as const;
const TURNO_COLOR: Record<string, string> = {
  mattino: '#b8842a',
  pomeriggio: '#2d5a3d',
  notte: '#1f3d2b',
  nessuno: '#9a9a9a',
};

function GraficoGantt({ documenti, unita }: { documenti: Documento[]; unita: UnitaOperativa[] }) {
  // Raggruppa per data_riferimento e unità
  const docsConData = documenti.filter((d) => d.data_riferimento);

  if (!docsConData.length) {
    return <Empty msg="Il Gantt mostra i turni per data. Carica documenti con data e turno per visualizzarlo." />;
  }

  const date = [...new Set(docsConData.map((d) => d.data_riferimento!))].sort();
  const unitaMap = new Map(unita.map((u) => [u.id, u.nome]));

  // Crea righe: una per unità operativa (o "Generale")
  const righe = unita.length > 0 ? unita : [{ id: '', nome: 'Generale' }];

  return (
    <>
      <h3 className="font-semibold text-ink mb-1">Gantt — Copertura turni per data</h3>
      <p className="text-xs text-ink-mute mb-4">Ogni cella indica se esiste un documento per quel turno in quella data</p>

      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-ink-soft font-medium w-32">Unità / Data</th>
              {date.map((d) => (
                <th key={d} className="px-1 py-2 text-ink-soft font-medium text-center min-w-[60px]">
                  {new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {righe.map((u) => (
              TURNI.map((turno, ti) => (
                <tr key={`${u.id}-${turno}`} className={ti === 0 ? 'border-t-2 border-line' : ''}>
                  <td className="px-2 py-1.5 text-ink-soft">
                    {ti === 0 ? <span className="font-medium text-ink">{u.nome}</span> : ''}
                    <span className="ml-1 capitalize text-ink-mute">{turno}</span>
                  </td>
                  {date.map((d) => {
                    const haDoc = docsConData.some(
                      (doc) =>
                        doc.data_riferimento === d &&
                        doc.turno === turno &&
                        (u.id === '' || doc.unita_operativa_id === u.id),
                    );
                    return (
                      <td key={d} className="px-1 py-1.5 text-center">
                        {haDoc ? (
                          <span
                            className="inline-block w-8 h-5 rounded text-white text-[10px] leading-5"
                            style={{ backgroundColor: TURNO_COLOR[turno] }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="inline-block w-8 h-5 rounded bg-bg-soft" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mt-4">
        {TURNI.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="w-4 h-4 rounded inline-block" style={{ backgroundColor: TURNO_COLOR[t] }} />
            {t}
          </span>
        ))}
      </div>
    </>
  );
}

function Empty({ msg }: { msg?: string }) {
  return (
    <div className="text-center py-16 text-ink-mute">
      <p className="text-sm">{msg ?? 'Nessun dato disponibile ancora.'}</p>
    </div>
  );
}

/* ── Studio ICA ── */
function StudioIca({ terapie, pazienti, orgName }: { terapie: TerapiaIca[]; pazienti: PazienteIca[]; orgName: string }) {
  // Filtra solo terapie antibiotiche
  const terapieAbx = terapie.filter((t) => classificaFarmaco(t.principio_attivo).isAntibiotico);

  // Paziente IDs in terapia antibiotica
  const pazIdSet = new Set(terapieAbx.map((t) => t.paziente_id));
  const pazientiInTerapia = pazienti.filter((p) => pazIdSet.has(p.id));

  // Sale coinvolte
  const saleSet = new Set(pazientiInTerapia.map((p) => p.sala));
  const saleN = saleSet.size;

  // % pazienti su antibiotico
  const percPaz = pazienti.length > 0 ? Math.round((pazientiInTerapia.length / pazienti.length) * 100) : 0;

  // Antibiotici ad alto costo
  const altoCostoSet = new Set(terapieAbx.filter((t) => isAltoCosto(t.principio_attivo)).map((t) => t.principio_attivo.toLowerCase()));

  // Bar chart data: per sala, conteggio per classe
  const classiUsate = new Set<string>();
  const bySala: Record<string, Record<string, number>> = {};
  for (const t of terapieAbx) {
    const paz = pazienti.find((p) => p.id === t.paziente_id);
    if (!paz) continue;
    const classe = classificaFarmaco(t.principio_attivo).classe ?? 'altri';
    const label = CLASSE_LABEL[classe as ClasseAntibiotico] ?? classe;
    classiUsate.add(label);
    if (!bySala[paz.sala]) bySala[paz.sala] = {};
    bySala[paz.sala][label] = (bySala[paz.sala][label] ?? 0) + 1;
  }
  const classiArr = [...classiUsate];
  const barData = Object.entries(bySala).map(([sala, counts]) => ({ sala, ...counts }));

  // Tabella per sala
  const saleRows = [...new Set(pazienti.map((p) => p.sala))].sort().map((sala) => {
    const pazSala = pazienti.filter((p) => p.sala === sala);
    const inTerapia = pazSala.filter((p) => pazIdSet.has(p.id));
    const terapieSala = terapieAbx.filter((t) => inTerapia.some((p) => p.id === t.paziente_id));
    const farmaci = [...new Set(terapieSala.map((t) => t.principio_attivo))].join(', ');
    const piano = pazSala[0]?.piano ?? '—';
    return { sala, piano, totali: pazSala.length, inTerapia: inTerapia.length, farmaci };
  });

  // Tabella per paziente in terapia
  const righeParzienti = pazientiInTerapia.sort((a, b) => a.sala.localeCompare(b.sala)).map((p) => {
    const tPaz = terapieAbx.filter((t) => t.paziente_id === p.id);
    return { paziente: p, terapie: tPaz };
  });

  function apriReportIca() {
    const now = new Date().toLocaleDateString('it-IT');
    const rows1 = saleRows.map((r) =>
      `<tr><td>${r.sala}</td><td>${r.piano}</td><td style="text-align:right">${r.totali}</td><td style="text-align:right">${r.inTerapia}</td><td>${r.farmaci || '—'}</td></tr>`
    ).join('');
    const rows2 = righeParzienti.flatMap(({ paziente: p, terapie: ts }) =>
      ts.map((t) =>
        `<tr><td>${p.numero_letto}</td><td>${p.nominativo}</td><td>${p.sala}</td><td>${t.principio_attivo}${t.dosaggio ? ' ' + t.dosaggio : ''}</td><td>${t.posologia ?? '—'}</td><td>${isAltoCosto(t.principio_attivo) ? '<span style="background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:9999px;font-size:10px;font-weight:bold">ALTO COSTO</span>' : ''}</td></tr>`
      )
    ).join('');
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Report ICA — ${orgName}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:24px}h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin-top:24px;margin-bottom:8px;color:#1f3d2b}p.sub{color:#666;font-size:11px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#f3f4f6;font-weight:600;padding:6px 8px;text-align:left;border-bottom:2px solid #d1d5db}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}.disclaimer{margin-top:32px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:10px;color:#92400e}@media print{.no-print{display:none}}</style></head>
<body>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:6px 14px;background:#1f3d2b;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Stampa</button>
<h1>Report ICA — Infezioni Correlate all'Assistenza</h1>
<p class="sub">${orgName} · Generato il ${now}</p>
<h2>Distribuzione per sala</h2>
<table><thead><tr><th>Sala</th><th>Piano</th><th style="text-align:right">Paz. totali</th><th style="text-align:right">In terapia Ab</th><th>Antibiotici in uso</th></tr></thead><tbody>${rows1}</tbody></table>
<h2>Pazienti in terapia antibiotica</h2>
<table><thead><tr><th>Letto</th><th>Paziente</th><th>Sala</th><th>Farmaco</th><th>Posologia</th><th></th></tr></thead><tbody>${rows2}</tbody></table>
<div class="disclaimer"><strong>Nota sulla privacy:</strong> Il presente documento contiene dati personali e sanitari. Deve essere trattato come documento riservato, conservato e smaltito secondo le normative vigenti (Reg. UE 2016/679 – GDPR). Non distribuire senza autorizzazione del responsabile del trattamento.</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  if (terapie.length === 0 && pazienti.length === 0) {
    return <Empty msg="Nessun dato ICA disponibile. Assicurati di aver caricato pazienti e terapie." />;
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="font-semibold text-ink">Infezioni Correlate all'Assistenza (ICA)</h3>
        <button onClick={apriReportIca} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Genera report ICA
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-blue-700">{pazientiInTerapia.length}</p>
          <p className="text-xs text-blue-500 mt-0.5">Pazienti in terapia antibiotica</p>
        </div>
        <div className="rounded-lg bg-bg-card border border-line px-3 py-2 text-center">
          <p className="text-2xl font-bold text-ink">{saleN}</p>
          <p className="text-xs text-ink-mute mt-0.5">Sale coinvolte</p>
        </div>
        <div className="rounded-lg bg-amber/10 border border-amber/30 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-amber-700">{percPaz}%</p>
          <p className="text-xs text-amber-600 mt-0.5">% pazienti su antibiotico</p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-red-700">{altoCostoSet.size}</p>
          <p className="text-xs text-red-500 mt-0.5">Antibiotici ad alto costo in uso</p>
        </div>
      </div>

      {/* Bar chart antibiotici per sala */}
      {barData.length > 0 && (
        <>
          <h4 className="text-sm font-medium text-ink mb-2">Antibiotici per sala</h4>
          <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 40)}>
            <BarChart data={barData} margin={{ left: 8, right: 16, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sala" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {classiArr.map((cl, i) => (
                <Bar key={cl} dataKey={cl} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === classiArr.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Tabella per sala */}
      <h4 className="text-sm font-medium text-ink mt-5 mb-2">Riepilogo per sala</h4>
      <div className="overflow-x-auto rounded-xl border border-line mb-5">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-soft border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-ink-soft">Sala</th>
              <th className="px-3 py-2 font-medium text-ink-soft">Piano</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Paz. totali</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">In terapia Ab</th>
              <th className="px-3 py-2 font-medium text-ink-soft">Antibiotici in uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {saleRows.map((r) => (
              <tr key={r.sala} className="bg-bg-card">
                <td className="px-3 py-1.5 font-medium text-ink">{r.sala}</td>
                <td className="px-3 py-1.5 text-ink-soft">{r.piano}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{r.totali}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${r.inTerapia > 0 ? 'text-blue-700' : 'text-ink-mute'}`}>{r.inTerapia}</td>
                <td className="px-3 py-1.5 text-ink-soft">{r.farmaci || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabella per paziente */}
      <h4 className="text-sm font-medium text-ink mt-5 mb-2">Pazienti in terapia antibiotica</h4>
      {righeParzienti.length === 0 ? (
        <p className="text-xs text-ink-mute py-4 text-center">Nessun paziente in terapia antibiotica.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg-soft border-b border-line text-left">
                <th className="px-3 py-2 font-medium text-ink-soft">Letto</th>
                <th className="px-3 py-2 font-medium text-ink-soft">Paziente</th>
                <th className="px-3 py-2 font-medium text-ink-soft">Sala</th>
                <th className="px-3 py-2 font-medium text-ink-soft">Farmaco</th>
                <th className="px-3 py-2 font-medium text-ink-soft">Posologia</th>
                <th className="px-3 py-2 font-medium text-ink-soft"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {righeParzienti.flatMap(({ paziente: p, terapie: ts }) =>
                ts.map((t, ti) => (
                  <tr key={`${p.id}-${t.id}`} className={isAltoCosto(t.principio_attivo) ? 'bg-red-50' : 'bg-bg-card'}>
                    <td className="px-3 py-1.5 tabular-nums text-ink-soft">{ti === 0 ? p.numero_letto : ''}</td>
                    <td className="px-3 py-1.5 font-medium text-ink">{ti === 0 ? p.nominativo : ''}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{ti === 0 ? p.sala : ''}</td>
                    <td className="px-3 py-1.5 text-ink">{t.principio_attivo}{t.dosaggio ? ` ${t.dosaggio}` : ''}</td>
                    <td className="px-3 py-1.5 text-ink-soft">{t.posologia ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      {isAltoCosto(t.principio_attivo) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-200 text-red-700 font-bold uppercase whitespace-nowrap">Alto costo</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ── Studio Antibiotici / Antivirali ── */
function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9àèìòù\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function prezzoGara(pa: string, gare: Gara[]): number | null {
  const n = norm(pa);
  const found = gare.find((g) => {
    const dn = norm(g.descrizione);
    return dn.includes(n) || n.split(' ').filter((w) => w.length > 4).some((w) => dn.includes(w));
  });
  return found?.prezzo_unitario ?? null;
}

function oggi() { return new Date().toISOString().slice(0, 10); }
function unMeseFa() {
  const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
}
function fmt(iso: string) { return new Date(iso).toLocaleDateString('it-IT'); }
function diffGiorni(dal: string, al: string) {
  return Math.max(1, Math.ceil((new Date(al).getTime() - new Date(dal).getTime()) / 86400000) + 1);
}


function StudioAntibiotici({ prodotti, gare, orgName }: { prodotti: Prodotto[]; gare: Gara[]; orgName: string }) {
  const [vista, setVista] = useState<'consumo' | 'classe' | 'costo'>('consumo');
  const [dal, setDal] = useState(unMeseFa());
  const [al, setAl] = useState(oggi());
  const [presetRange, setPresetRange] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [showRelazione, setShowRelazione] = useState(false);

  function applicaPreset(p: '7' | '30' | '90' | 'custom') {
    setPresetRange(p);
    if (p === 'custom') return;
    const days = parseInt(p);
    const fine = new Date();
    const inizio = new Date();
    inizio.setDate(fine.getDate() - days + 1);
    setDal(inizio.toISOString().slice(0, 10));
    setAl(fine.toISOString().slice(0, 10));
  }

  const giorni = diffGiorni(dal, al);

  const abxProdotti = prodotti
    .map((p) => {
      const info = classificaFarmaco(p.principio_attivo);
      if (!info.isAntibiotico) return null;
      const altoCosto = isAltoCosto(p.principio_attivo);
      const prezzo = prezzoGara(p.principio_attivo, gare);
      const consumoPeriodo = p.consumo_giornaliero > 0 ? Math.round(p.consumo_giornaliero * giorni) : 0;
      const costoPeriodo = prezzo != null && consumoPeriodo > 0 ? prezzo * consumoPeriodo : null;
      return { ...p, classe: info.classe!, altoCosto, prezzo, consumoPeriodo, costoPeriodo };
    })
    .filter(Boolean) as AbxProdotto[];

  if (!abxProdotti.length) {
    return <Empty msg="Nessun antibiotico/antivirale riconosciuto nel magazzino. Carica farmaci per avviare lo studio." />;
  }

  const totaleCosto = abxProdotti.reduce((s, p) => s + (p.costoPeriodo ?? 0), 0);
  const totalConsumo = abxProdotti.reduce((s, p) => s + p.consumoPeriodo, 0);
  const altoCostoN = abxProdotti.filter((p) => p.altoCosto).length;

  const datoConsumo = abxProdotti
    .filter((p) => p.consumoPeriodo > 0)
    .sort((a, b) => b.consumoPeriodo - a.consumoPeriodo)
    .slice(0, 20)
    .map((p) => ({
      nome: `${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''}`,
      consumo: p.consumoPeriodo,
      fill: p.altoCosto ? '#c0392b' : p.classe === 'carbapenemi' || p.classe === 'glicopeptidi' || p.classe === 'polimixine' || p.classe === 'ossazolidinoni' ? '#b8842a' : '#1f3d2b',
    }));

  const byClasse: Record<string, number> = {};
  for (const p of abxProdotti) {
    const label = CLASSE_LABEL[p.classe];
    byClasse[label] = (byClasse[label] ?? 0) + 1;
  }
  const datoClasse = Object.entries(byClasse).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  const datoCosto = abxProdotti
    .filter((p) => p.costoPeriodo != null && p.costoPeriodo > 0)
    .sort((a, b) => (b.costoPeriodo ?? 0) - (a.costoPeriodo ?? 0))
    .slice(0, 15)
    .map((p) => ({
      nome: `${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''}`,
      costo: Math.round(p.costoPeriodo!),
      fill: p.altoCosto ? '#c0392b' : '#b8842a',
    }));

  return (
    <>
      {/* ── Selettore periodo ── */}
      <div className="rounded-xl border border-line bg-bg-soft px-4 py-3 mb-5">
        <p className="text-xs font-semibold text-ink-mute uppercase tracking-wider mb-2">Periodo di analisi</p>
        <div className="flex flex-wrap gap-2 items-center">
          {([['7', '7 giorni'], ['30', '30 giorni'], ['90', '3 mesi'], ['custom', 'Personalizzato']] as const).map(([v, label]) => (
            <button key={v} onClick={() => applicaPreset(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${presetRange === v ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40 hover:text-ink'}`}>
              {label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-1">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-ink-mute">Dal</label>
              <input type="date" value={dal} max={al} onChange={e => { setDal(e.target.value); setPresetRange('custom'); }}
                className="input-base py-1 text-xs w-36" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-ink-mute">Al</label>
              <input type="date" value={al} min={dal} max={oggi()} onChange={e => { setAl(e.target.value); setPresetRange('custom'); }}
                className="input-base py-1 text-xs w-36" />
            </div>
            <span className="text-xs text-ink-mute font-medium">{giorni} giorni</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="font-semibold text-ink">
          Studio consumo antibiotici / antivirali
          <span className="ml-2 text-xs font-normal text-ink-mute">{fmt(dal)} — {fmt(al)}</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {(['consumo', 'classe', 'costo'] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${vista === v ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'}`}>
                {v === 'consumo' ? 'Consumo' : v === 'classe' ? 'Per classe' : 'Costo'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowRelazione(true)}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Genera relazione
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-red-700">{abxProdotti.length}</p>
          <p className="text-xs text-red-500 mt-0.5">Antibiotici</p>
        </div>
        <div className="rounded-lg bg-amber/10 border border-amber/30 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-amber-700">{altoCostoN}</p>
          <p className="text-xs text-amber-600 mt-0.5">Alto costo / last-resort</p>
        </div>
        <div className="rounded-lg bg-bg-card border border-line px-3 py-2 text-center">
          <p className="text-2xl font-bold text-ink">{totalConsumo > 0 ? totalConsumo : '—'}</p>
          <p className="text-xs text-ink-mute mt-0.5">Unità consumate ({giorni}gg)</p>
        </div>
        <div className="rounded-lg bg-forest-tint border border-forest/20 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-forest">{totaleCosto > 0 ? `€ ${Math.round(totaleCosto).toLocaleString('it-IT')}` : '—'}</p>
          <p className="text-xs text-forest/70 mt-0.5">Costo stimato periodo</p>
        </div>
      </div>

      {/* Grafici */}
      {vista === 'consumo' && (
        datoConsumo.length === 0 ? <Empty msg="Imposta il consumo/die nei prodotti per visualizzare il grafico." /> :
        <>
          <p className="text-xs text-ink-mute mb-3">Consumo totale nel periodo selezionato · Rosso = alto costo · Ambra = classe critica</p>
          <ResponsiveContainer width="100%" height={Math.max(300, datoConsumo.length * 30)}>
            <BarChart data={datoConsumo} layout="vertical" margin={{ left: 20, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} label={{ value: 'unità', position: 'insideRight', offset: 10, fontSize: 10 }} />
              <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} unità`, `Consumo ${giorni}gg`]} />
              <Bar dataKey="consumo" radius={[0, 4, 4, 0]}>
                {datoConsumo.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {vista === 'classe' && (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={datoClasse} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
              {datoClasse.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => [`${v} prodotti`, '']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}

      {vista === 'costo' && (
        datoCosto.length === 0 ? <Empty msg="Inserisci i prezzi nelle gare d'appalto e imposta il consumo/die nei prodotti." /> :
        <>
          <p className="text-xs text-ink-mute mb-3">Costo stimato nel periodo (consumo/die × {giorni} gg × prezzo da gara)</p>
          <ResponsiveContainer width="100%" height={Math.max(300, datoCosto.length * 32)}>
            <BarChart data={datoCosto} layout="vertical" margin={{ left: 20, right: 80 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `€${v.toLocaleString('it-IT')}`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`€ ${Number(v).toLocaleString('it-IT')}`, `Costo ${giorni}gg`]} />
              <Bar dataKey="costo" radius={[0, 4, 4, 0]}>
                {datoCosto.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {showRelazione && (
        <RelazioneAntibioticiModal
          prodotti={abxProdotti}
          dal={dal} al={al} giorni={giorni}
          orgName={orgName}
          onClose={() => setShowRelazione(false)}
        />
      )}

      {/* Tabella dettaglio */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-soft border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-ink-soft">Principio attivo</th>
              <th className="px-3 py-2 font-medium text-ink-soft">Classe</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Scorta att.</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Consumo/die</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right bg-forest/5">Consumo {giorni}gg</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Prezzo unit.</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right bg-red-50">Costo periodo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {abxProdotti.sort((a, b) => (b.costoPeriodo ?? 0) - (a.costoPeriodo ?? 0)).map((p) => (
              <tr key={p.id} className={p.altoCosto ? 'bg-red-50' : 'bg-bg-card'}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.altoCosto && <span className="text-[9px] px-1 py-0.5 rounded-full bg-red-200 text-red-700 font-bold uppercase">ALTO COSTO</span>}
                    <span className={`font-medium ${p.altoCosto ? 'text-red-700' : 'text-red-600'}`}>{p.principio_attivo}</span>
                    {p.dosaggio && <span className="text-ink-mute">{p.dosaggio}</span>}
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-soft">{CLASSE_LABEL[p.classe]}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{p.quantita}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{p.consumo_giornaliero > 0 ? p.consumo_giornaliero : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-ink bg-forest/5">{p.consumoPeriodo > 0 ? p.consumoPeriodo : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{p.prezzo != null ? `€ ${p.prezzo.toLocaleString('it-IT', { minimumFractionDigits: 4 })}` : '—'}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold bg-red-50 ${p.altoCosto ? 'text-red-700' : 'text-amber-700'}`}>
                  {p.costoPeriodo != null && p.costoPeriodo > 0 ? `€ ${Math.round(p.costoPeriodo).toLocaleString('it-IT')}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-bg-soft">
              <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-ink-soft">TOTALE</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-ink bg-forest/5">{totalConsumo > 0 ? totalConsumo : '—'}</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-red-700 bg-red-50">{totaleCosto > 0 ? `€ ${Math.round(totaleCosto).toLocaleString('it-IT')}` : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
