'use client';

import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formaLabel } from '@/lib/prodotti';
import { CAT_LABELS, type CategoriaArticolo } from '@/lib/types';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';

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

type TipoGrafico = 'barre' | 'linea' | 'torta' | 'gantt' | 'scorte' | 'consumo';

const TABS: { id: TipoGrafico; label: string }[] = [
  { id: 'scorte',  label: 'Scorte' },
  { id: 'consumo', label: 'Consumo/die' },
  { id: 'barre',   label: 'Per categoria' },
  { id: 'torta',   label: 'Distribuzione forme' },
  { id: 'linea',   label: 'Caricamenti nel tempo' },
  { id: 'gantt',   label: 'Gantt turni' },
];

export function GraficiView({ prodotti, documenti, unita }: {
  prodotti: Prodotto[];
  documenti: Documento[];
  unita: UnitaOperativa[];
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
        {tab === 'scorte'  && <GraficoScorte prodotti={prodotti} />}
        {tab === 'consumo' && <GraficoConsumo prodotti={prodotti} />}
        {tab === 'barre'   && <GraficoCategorie prodotti={prodotti} />}
        {tab === 'torta'   && <GraficoForme prodotti={prodotti} />}
        {tab === 'linea'   && <GraficoCaricamenti documenti={documenti} />}
        {tab === 'gantt'   && <GraficoGantt documenti={documenti} unita={unita} />}
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
