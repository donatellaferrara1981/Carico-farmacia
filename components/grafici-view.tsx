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

type TipoGrafico = 'barre' | 'linea' | 'torta' | 'gantt' | 'scorte' | 'consumo' | 'antibiotici';

const TABS: { id: TipoGrafico; label: string }[] = [
  { id: 'scorte',       label: 'Scorte' },
  { id: 'consumo',      label: 'Consumo/die' },
  { id: 'antibiotici',  label: '🦠 Antibiotici' },
  { id: 'barre',        label: 'Per categoria' },
  { id: 'torta',        label: 'Distribuzione forme' },
  { id: 'linea',        label: 'Caricamenti nel tempo' },
  { id: 'gantt',        label: 'Gantt turni' },
];

export function GraficiView({ prodotti, documenti, unita, gare = [] }: {
  prodotti: Prodotto[];
  documenti: Documento[];
  unita: UnitaOperativa[];
  gare?: Gara[];
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
        {tab === 'antibiotici' && <StudioAntibiotici prodotti={prodotti} gare={gare} />}
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

function StudioAntibiotici({ prodotti, gare }: { prodotti: Prodotto[]; gare: Gara[] }) {
  const [vista, setVista] = useState<'consumo' | 'classe' | 'costo'>('consumo');

  const abxProdotti = prodotti
    .map((p) => {
      const info = classificaFarmaco(p.principio_attivo);
      if (!info.isAntibiotico) return null;
      const altoCosto = isAltoCosto(p.principio_attivo);
      const prezzo = prezzoGara(p.principio_attivo, gare);
      const costoGiornaliero = prezzo != null && p.consumo_giornaliero > 0
        ? prezzo * p.consumo_giornaliero : null;
      const costoMensile = costoGiornaliero != null ? costoGiornaliero * 30 : null;
      return { ...p, classe: info.classe!, altoCosto, prezzo, costoGiornaliero, costoMensile };
    })
    .filter(Boolean) as (Prodotto & { classe: ClasseAntibiotico; altoCosto: boolean; prezzo: number | null; costoGiornaliero: number | null; costoMensile: number | null })[];

  if (!abxProdotti.length) {
    return <Empty msg="Nessun antibiotico/antivirale riconosciuto nel magazzino. Carica farmaci per avviare lo studio." />;
  }

  const totaleMensile = abxProdotti.reduce((s, p) => s + (p.costoMensile ?? 0), 0);
  const altoCostoN = abxProdotti.filter((p) => p.altoCosto).length;

  // Dati grafico per consumo
  const datoConsumo = abxProdotti
    .filter((p) => p.consumo_giornaliero > 0)
    .sort((a, b) => b.consumo_giornaliero - a.consumo_giornaliero)
    .slice(0, 20)
    .map((p) => ({
      nome: `${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''}`,
      consumo: p.consumo_giornaliero,
      fill: p.altoCosto ? '#c0392b' : p.classe === 'carbapenemi' || p.classe === 'glicopeptidi' || p.classe === 'polimixine' || p.classe === 'ossazolidinoni' ? '#b8842a' : '#1f3d2b',
    }));

  // Dati grafico per classe
  const byClasse: Record<string, number> = {};
  for (const p of abxProdotti) {
    const label = CLASSE_LABEL[p.classe];
    byClasse[label] = (byClasse[label] ?? 0) + 1;
  }
  const datoClasse = Object.entries(byClasse).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Dati grafico per costo mensile
  const datoCosto = abxProdotti
    .filter((p) => p.costoMensile != null && p.costoMensile > 0)
    .sort((a, b) => (b.costoMensile ?? 0) - (a.costoMensile ?? 0))
    .slice(0, 15)
    .map((p) => ({
      nome: `${p.principio_attivo}${p.dosaggio ? ` ${p.dosaggio}` : ''}`,
      costo: Math.round(p.costoMensile!),
      fill: p.altoCosto ? '#c0392b' : '#b8842a',
    }));

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="font-semibold text-ink">Studio consumo antibiotici / antivirali</h3>
        <div className="flex gap-1.5">
          {(['consumo', 'classe', 'costo'] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${vista === v ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'}`}>
              {v === 'consumo' ? 'Consumo/die' : v === 'classe' ? 'Per classe' : 'Costo stimato'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-red-700">{abxProdotti.length}</p>
          <p className="text-xs text-red-500 mt-0.5">Antibiotici in magazzino</p>
        </div>
        <div className="rounded-lg bg-amber/10 border border-amber/30 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-amber-700">{altoCostoN}</p>
          <p className="text-xs text-amber-600 mt-0.5">Ad alto costo / last-resort</p>
        </div>
        <div className="rounded-lg bg-forest-tint border border-forest/20 px-3 py-2 text-center">
          <p className="text-2xl font-bold text-forest">{totaleMensile > 0 ? `€ ${totaleMensile.toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '—'}</p>
          <p className="text-xs text-forest/70 mt-0.5">Costo mensile stimato</p>
        </div>
      </div>

      {/* Grafici */}
      {vista === 'consumo' && (
        datoConsumo.length === 0 ? <Empty msg="Imposta il consumo/die nei prodotti per visualizzare il grafico." /> :
        <>
          <p className="text-xs text-ink-mute mb-3">Rosso = alto costo/last-resort · Ambra = classe critica · Verde = altri</p>
          <ResponsiveContainer width="100%" height={Math.max(300, datoConsumo.length * 30)}>
            <BarChart data={datoConsumo} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} pz/die`, 'Consumo']} />
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
        datoCosto.length === 0 ? <Empty msg="Nessun prezzo disponibile. Inserisci i prezzi nelle gare d'appalto e imposta il consumo/die nei prodotti." /> :
        <>
          <p className="text-xs text-ink-mute mb-3">Costo mensile stimato (consumo/die × prezzo unitario da gara × 30 gg) · Rosso = alto costo</p>
          <ResponsiveContainer width="100%" height={Math.max(300, datoCosto.length * 32)}>
            <BarChart data={datoCosto} layout="vertical" margin={{ left: 20, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `€${v}`} />
              <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`€ ${Number(v).toLocaleString('it-IT')}`, 'Costo/mese']} />
              <Bar dataKey="costo" radius={[0, 4, 4, 0]}>
                {datoCosto.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Tabella dettaglio */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-soft border-b border-line text-left">
              <th className="px-3 py-2 font-medium text-ink-soft">Principio attivo</th>
              <th className="px-3 py-2 font-medium text-ink-soft">Classe</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Scorta</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Consumo/die</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Prezzo unit.</th>
              <th className="px-3 py-2 font-medium text-ink-soft text-right">Costo/mese</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {abxProdotti.sort((a, b) => (b.costoMensile ?? 0) - (a.costoMensile ?? 0)).map((p) => (
              <tr key={p.id} className={p.altoCosto ? 'bg-red-50' : 'bg-bg-card'}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {p.altoCosto && <span className="text-[9px] px-1 py-0.5 rounded-full bg-red-200 text-red-700 font-bold uppercase">ALTO COSTO</span>}
                    <span className={`font-medium ${p.altoCosto ? 'text-red-700' : 'text-red-600'}`}>{p.principio_attivo}</span>
                    {p.dosaggio && <span className="text-ink-mute">{p.dosaggio}</span>}
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-soft">{CLASSE_LABEL[p.classe]}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{p.quantita}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{p.consumo_giornaliero > 0 ? p.consumo_giornaliero : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{p.prezzo != null ? `€ ${p.prezzo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${p.altoCosto ? 'text-red-700' : 'text-amber-700'}`}>
                  {p.costoMensile != null ? `€ ${Math.round(p.costoMensile).toLocaleString('it-IT')}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
