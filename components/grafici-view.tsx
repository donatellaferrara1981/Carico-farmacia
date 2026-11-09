'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Save, Trash2, BarChart3 } from 'lucide-react';
import { formaLabel } from '@/lib/prodotti';
import { CAT_LABELS, type CategoriaArticolo } from '@/lib/types';
import { classificaFarmaco, CLASSE_LABEL } from '@/lib/antibiotici';

/* ───────────────────────── tipi ───────────────────────── */

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

interface Punto { nome: string; valore: number; colore?: string }

type Tipo = 'barre' | 'colonne' | 'linea' | 'ciambella';
type Misura = 'quantita' | 'consumo' | 'autonomia' | 'prodotti' | 'documenti';
type Dimensione = 'principio' | 'categoria' | 'forma' | 'uo' | 'classe' | 'turno' | 'giorno' | 'settimana' | 'mese';

interface Config {
  misura: Misura;
  dimensione: Dimensione;
  tipo: Tipo;
  categoria: string; // 'tutte' | categoria
  uo: string;        // 'tutte' | id
  top: number;       // 0 = tutti
  ordine: 'desc' | 'asc';
}
interface Salvato { id: string; nome: string; cfg: Config }

/* ───────────────────────── palette e formati ───────────────────────── */

const PALETTE = ['#0a4d7a', '#1aa3a3', '#3f8fc0', '#b8842a', '#6fc2c2', '#e8a838', '#c0392b', '#d4956a'];
const BLU = '#0a4d7a';
const ROSSO = '#c0392b';
const AMBRA = '#b8842a';
const VERDE = '#2f7d4f';

const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const fmt = (n: number) => nf.format(n);
const taglia = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/* ───────────────────────── opzioni del costruttore ───────────────────────── */

const MISURE: { id: Misura; label: string; unita: string; fonte: 'prodotti' | 'documenti'; dimensioni: Dimensione[] }[] = [
  { id: 'quantita',  label: 'Scorta (pezzi)',         unita: 'pz',        fonte: 'prodotti',  dimensioni: ['principio', 'categoria', 'forma', 'uo', 'classe'] },
  { id: 'consumo',   label: 'Consumo giornaliero',    unita: 'pz/die',    fonte: 'prodotti',  dimensioni: ['principio', 'categoria', 'forma', 'uo', 'classe'] },
  { id: 'autonomia', label: 'Autonomia (giorni)',     unita: 'giorni',    fonte: 'prodotti',  dimensioni: ['principio', 'categoria', 'forma', 'uo', 'classe'] },
  { id: 'prodotti',  label: 'Numero di prodotti',     unita: 'prodotti',  fonte: 'prodotti',  dimensioni: ['categoria', 'forma', 'uo', 'classe'] },
  { id: 'documenti', label: 'Documenti caricati',     unita: 'documenti', fonte: 'documenti', dimensioni: ['categoria', 'uo', 'turno', 'giorno', 'settimana', 'mese'] },
];

const DIM_LABEL: Record<Dimensione, string> = {
  principio: 'Principio attivo',
  categoria: 'Categoria',
  forma: 'Forma farmaceutica',
  uo: 'Unità operativa',
  classe: 'Classe antibiotica',
  turno: 'Turno',
  giorno: 'Giorno',
  settimana: 'Settimana',
  mese: 'Mese',
};
const DIM_TEMPO: Dimensione[] = ['giorno', 'settimana', 'mese'];

const TIPI: { id: Tipo; label: string }[] = [
  { id: 'barre', label: 'Barre' },
  { id: 'colonne', label: 'Colonne' },
  { id: 'linea', label: 'Linea' },
  { id: 'ciambella', label: 'Ciambella' },
];

const CONFIG_INIZIALE: Config = {
  misura: 'consumo', dimensione: 'principio', tipo: 'barre', categoria: 'tutte', uo: 'tutte', top: 10, ordine: 'desc',
};

const CHIAVE_SALVATI = 'grafici-salvati-v1';

/* ───────────────────────── calcolo dati ───────────────────────── */

function lunedi(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const giorno = (x.getDay() + 6) % 7; // 0 = lunedì
  x.setDate(x.getDate() - giorno);
  return x;
}
const isoGiorno = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function calcola(cfg: Config, prodotti: Prodotto[], documenti: Documento[], unita: UnitaOperativa[]): Punto[] {
  const misura = MISURE.find((m) => m.id === cfg.misura)!;
  const nomeUo = (id: string | null) => (id ? unita.find((u) => u.id === id)?.nome ?? 'Altra UO' : 'Tutta l’organizzazione');
  const nomeCat = (c: string) => CAT_LABELS[c as CategoriaArticolo] ?? c;

  // gruppi: chiave → { nome, ordineTempo, somma, consumo, n }
  const gruppi = new Map<string, { nome: string; chiave: string; q: number; c: number; n: number }>();
  const aggiungi = (chiave: string, nome: string, q: number, c: number) => {
    const g = gruppi.get(chiave) ?? { nome, chiave, q: 0, c: 0, n: 0 };
    g.q += q; g.c += c; g.n += 1;
    gruppi.set(chiave, g);
  };

  if (misura.fonte === 'prodotti') {
    for (const p of prodotti) {
      if (cfg.categoria !== 'tutte' && p.categoria !== cfg.categoria) continue;
      if (cfg.uo !== 'tutte' && p.unita_operativa_id !== cfg.uo) continue;
      const q = p.quantita ?? 0;
      const c = p.consumo_giornaliero ?? 0;
      if ((cfg.misura === 'quantita' || cfg.misura === 'autonomia') && q < 0) continue;
      if (cfg.misura === 'consumo' && c <= 0) continue;
      if (cfg.misura === 'autonomia' && c <= 0) continue;

      let chiave: string; let nome: string;
      switch (cfg.dimensione) {
        case 'principio': nome = p.principio_attivo; chiave = p.principio_attivo.toLowerCase(); break;
        case 'categoria': nome = nomeCat(p.categoria); chiave = p.categoria; break;
        case 'forma': nome = formaLabel(p.forma_farmaceutica); chiave = p.forma_farmaceutica; break;
        case 'uo': nome = nomeUo(p.unita_operativa_id); chiave = p.unita_operativa_id ?? '-'; break;
        default: {
          const info = classificaFarmaco(p.principio_attivo);
          if (!info.isAntibiotico || !info.classe) continue; // solo antibiotici
          nome = CLASSE_LABEL[info.classe] ?? info.classe; chiave = info.classe;
        }
      }
      aggiungi(chiave, nome, q, c);
    }
  } else {
    for (const d of documenti) {
      if (cfg.categoria !== 'tutte' && d.categoria !== cfg.categoria) continue;
      if (cfg.uo !== 'tutte' && d.unita_operativa_id !== cfg.uo) continue;
      const data = new Date(d.data_riferimento ?? d.created_at);
      if (Number.isNaN(data.getTime())) continue;
      let chiave: string; let nome: string;
      switch (cfg.dimensione) {
        case 'categoria': nome = nomeCat(d.categoria); chiave = d.categoria; break;
        case 'uo': nome = nomeUo(d.unita_operativa_id); chiave = d.unita_operativa_id ?? '-'; break;
        case 'turno': nome = d.turno ? d.turno[0].toUpperCase() + d.turno.slice(1) : 'Non indicato'; chiave = d.turno ?? '-'; break;
        case 'giorno':
          chiave = isoGiorno(data); nome = data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }); break;
        case 'settimana': {
          const l = lunedi(data); chiave = isoGiorno(l);
          nome = 'sett. ' + l.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }); break;
        }
        default:
          chiave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
          nome = data.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
      }
      aggiungi(chiave, nome, 0, 0);
    }
  }

  let punti = Array.from(gruppi.values()).map((g) => {
    let valore = 0;
    if (cfg.misura === 'quantita') valore = g.q;
    else if (cfg.misura === 'consumo') valore = g.c;
    else if (cfg.misura === 'autonomia') valore = g.c > 0 ? g.q / g.c : 0;
    else valore = g.n;
    return { nome: g.nome, chiave: g.chiave, valore: Math.round(valore * 10) / 10 };
  });

  if (DIM_TEMPO.includes(cfg.dimensione)) {
    // cronologico, ultimi N periodi
    punti.sort((a, b) => a.chiave.localeCompare(b.chiave));
    if (cfg.top > 0) punti = punti.slice(-cfg.top);
  } else {
    punti.sort((a, b) => (cfg.ordine === 'desc' ? b.valore - a.valore : a.valore - b.valore));
    if (cfg.top > 0) punti = punti.slice(0, cfg.top);
  }
  return punti.map(({ nome, valore }) => ({ nome, valore }));
}

/* ───────────────────────── disegno del grafico ───────────────────────── */

function Grafico({ tipo, dati, unita, altezzaMin = 220 }: { tipo: Tipo; dati: Punto[]; unita: string; altezzaMin?: number }) {
  if (dati.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-ink-mute text-sm py-10">
        <BarChart3 className="w-8 h-8 opacity-30 mb-2" />
        Nessun dato per questa selezione
      </div>
    );
  }

  const tip = (v: unknown) => `${fmt(Number(v))} ${unita}`;
  const colore = (p: Punto, i: number) => p.colore ?? (tipo === 'ciambella' ? PALETTE[i % PALETTE.length] : BLU);

  if (tipo === 'ciambella') {
    const totale = dati.reduce((s, d) => s + d.valore, 0) || 1;
    return (
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dati} dataKey="valore" nameKey="nome" innerRadius="58%" outerRadius="95%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                {dati.map((p, i) => <Cell key={p.nome} fill={colore(p, i)} />)}
              </Pie>
              <Tooltip formatter={tip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 min-w-0 w-full space-y-1.5 text-sm">
          {dati.map((p, i) => (
            <li key={p.nome} className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colore(p, i) }} />
              <span className="truncate flex-1 text-ink">{p.nome}</span>
              <span className="text-ink-soft tabular-nums">{fmt(p.valore)}</span>
              <span className="text-ink-mute text-xs w-10 text-right tabular-nums">{Math.round((p.valore / totale) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (tipo === 'barre') {
    const altezza = Math.max(altezzaMin, dati.length * 34 + 16);
    const larghEtichette = Math.min(170, Math.max(90, Math.max(...dati.map((d) => d.nome.length)) * 6.2));
    return (
      <div style={{ height: altezza }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dati} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 0 }} barCategoryGap="28%">
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="nome" width={larghEtichette} tickLine={false} axisLine={false}
              tick={{ fontSize: 12, fill: '#1c1c1c' }} tickFormatter={(v: string) => taglia(v, 26)} />
            <Tooltip formatter={tip} cursor={{ fill: 'rgba(10,77,122,0.06)' }} />
            <Bar dataKey="valore" radius={[0, 6, 6, 0]}>
              {dati.map((p, i) => <Cell key={p.nome} fill={colore(p, i)} />)}
              <LabelList dataKey="valore" position="right" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 12, fill: '#5a5a5a' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const inclina = dati.length > 6;
  const altezza = inclina ? altezzaMin + 40 : altezzaMin;
  if (tipo === 'linea') {
    return (
      <div style={{ height: altezza }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dati} margin={{ top: 16, right: 16, bottom: inclina ? 24 : 4, left: -8 }}>
            <CartesianGrid vertical={false} stroke="#d5e0e6" />
            <XAxis dataKey="nome" tickLine={false} axisLine={{ stroke: '#d5e0e6' }} tick={{ fontSize: 11, fill: '#5a5a5a' }}
              interval={0} angle={inclina ? -35 : 0} textAnchor={inclina ? 'end' : 'middle'} tickFormatter={(v: string) => taglia(v, 14)} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9a9a9a' }} width={40} allowDecimals={false} />
            <Tooltip formatter={tip} />
            <Line type="monotone" dataKey="valore" stroke={BLU} strokeWidth={2.5} dot={{ r: 3.5, fill: BLU, strokeWidth: 0 }} activeDot={{ r: 5 }}>
              <LabelList dataKey="valore" position="top" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 11, fill: '#5a5a5a' }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ height: altezza }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dati} margin={{ top: 20, right: 8, bottom: inclina ? 24 : 4, left: -8 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="#d5e0e6" />
          <XAxis dataKey="nome" tickLine={false} axisLine={{ stroke: '#d5e0e6' }} tick={{ fontSize: 11, fill: '#5a5a5a' }}
            interval={0} angle={inclina ? -35 : 0} textAnchor={inclina ? 'end' : 'middle'} tickFormatter={(v: string) => taglia(v, 14)} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9a9a9a' }} width={40} allowDecimals={false} />
          <Tooltip formatter={tip} cursor={{ fill: 'rgba(10,77,122,0.06)' }} />
          <Bar dataKey="valore" radius={[6, 6, 0, 0]}>
            {dati.map((p, i) => <Cell key={p.nome} fill={colore(p, i)} />)}
            <LabelList dataKey="valore" position="top" formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 11, fill: '#5a5a5a' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Scheda({ titolo, sotto, azioni, children }: { titolo: string; sotto?: string; azioni?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-bg-card p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink leading-tight">{titolo}</h3>
          {sotto && <p className="text-xs text-ink-mute mt-0.5">{sotto}</p>}
        </div>
        {azioni}
      </header>
      {children}
    </section>
  );
}

/* ───────────────────────── vista principale ───────────────────────── */

export function GraficiView({ prodotti, documenti, unita }: {
  prodotti: Prodotto[];
  documenti: Documento[];
  unita: UnitaOperativa[];
  // props mantenute per compatibilità con la pagina (non più usate)
  gare?: unknown[];
  orgName?: string;
  terapiePazienti?: unknown[];
  pazientiIca?: unknown[];
}) {
  /* — Panoramica (grafici fissi) — */
  const panoramica = useMemo(() => {
    const autonomia = calcola({ ...CONFIG_INIZIALE, misura: 'autonomia', dimensione: 'principio', top: 10, ordine: 'asc' }, prodotti, documenti, unita)
      .map((p) => ({ ...p, colore: p.valore < 3 ? ROSSO : p.valore < 7 ? AMBRA : VERDE }));
    const consumi = calcola({ ...CONFIG_INIZIALE, misura: 'consumo', dimensione: 'principio', top: 10, ordine: 'desc' }, prodotti, documenti, unita);
    const perCategoria = calcola({ ...CONFIG_INIZIALE, misura: 'prodotti', dimensione: 'categoria', top: 0 }, prodotti, documenti, unita);
    const abx = calcola({ ...CONFIG_INIZIALE, misura: 'prodotti', dimensione: 'classe', top: 0 }, prodotti, documenti, unita);
    const caricamenti = calcola({ ...CONFIG_INIZIALE, misura: 'documenti', dimensione: 'settimana', tipo: 'colonne', top: 12 }, prodotti, documenti, unita);
    return { autonomia, consumi, perCategoria, abx, caricamenti };
  }, [prodotti, documenti, unita]);

  /* — Costruttore — */
  const [cfg, setCfg] = useState<Config>(CONFIG_INIZIALE);
  const [nome, setNome] = useState('');
  const [salvati, setSalvati] = useState<Salvato[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHIAVE_SALVATI);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSalvati(arr);
      }
    } catch { /* storage non disponibile */ }
  }, []);

  function persisti(lista: Salvato[]) {
    setSalvati(lista);
    try { localStorage.setItem(CHIAVE_SALVATI, JSON.stringify(lista)); } catch { /* ignora */ }
  }

  const misura = MISURE.find((m) => m.id === cfg.misura)!;
  const tempo = DIM_TEMPO.includes(cfg.dimensione);

  function cambiaMisura(id: Misura) {
    const m = MISURE.find((x) => x.id === id)!;
    const dimensione = m.dimensioni.includes(cfg.dimensione) ? cfg.dimensione : m.dimensioni[0];
    setCfg({ ...cfg, misura: id, dimensione });
  }
  function cambiaDimensione(d: Dimensione) {
    const eraTempo = tempo; const ora = DIM_TEMPO.includes(d);
    setCfg({
      ...cfg, dimensione: d,
      tipo: ora && !eraTempo ? 'linea' : !ora && eraTempo ? 'barre' : cfg.tipo,
      top: ora && !eraTempo ? 12 : !ora && eraTempo ? 10 : cfg.top,
    });
  }

  const dati = useMemo(() => calcola(cfg, prodotti, documenti, unita), [cfg, prodotti, documenti, unita]);
  const titoloAuto = `${misura.label} per ${DIM_LABEL[cfg.dimensione].toLowerCase()}`;

  function salva() {
    persisti([...salvati, { id: String(Date.now()), nome: nome.trim() || titoloAuto, cfg }]);
    setNome('');
  }

  const selectCls = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:border-forest';
  const labelCls = 'block text-xs font-semibold text-ink-soft mb-1';

  return (
    <div className="space-y-8">
      {/* Panoramica */}
      <div>
        <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">Panoramica</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Scheda titolo="Scorte in esaurimento" sotto="Giorni di autonomia (scorta ÷ consumo) · rosso < 3, ambra < 7">
            <Grafico tipo="barre" dati={panoramica.autonomia} unita="giorni" />
          </Scheda>
          <Scheda titolo="Maggiori consumi" sotto="Pezzi al giorno, primi 10">
            <Grafico tipo="barre" dati={panoramica.consumi} unita="pz/die" />
          </Scheda>
          <Scheda titolo="Prodotti per categoria" sotto="Numero di prodotti in catalogo">
            <Grafico tipo="ciambella" dati={panoramica.perCategoria} unita="prodotti" />
          </Scheda>
          <Scheda titolo="Antibiotici per classe" sotto="Numero di prodotti per classe">
            <Grafico tipo="barre" dati={panoramica.abx} unita="prodotti" />
          </Scheda>
          <div className="md:col-span-2">
            <Scheda titolo="Documenti caricati" sotto="Ultime 12 settimane">
              <Grafico tipo="colonne" dati={panoramica.caricamenti} unita="documenti" />
            </Scheda>
          </div>
        </div>
      </div>

      {/* Costruttore */}
      <div>
        <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-3">Crea il tuo grafico</h2>
        <div className="rounded-2xl border border-line bg-bg-card p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Cosa misurare</label>
              <select className={selectCls} value={cfg.misura} onChange={(e) => cambiaMisura(e.target.value as Misura)}>
                {MISURE.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Raggruppa per</label>
              <select className={selectCls} value={cfg.dimensione} onChange={(e) => cambiaDimensione(e.target.value as Dimensione)}>
                {misura.dimensioni.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <select className={selectCls} value={cfg.categoria} onChange={(e) => setCfg({ ...cfg, categoria: e.target.value })}>
                <option value="tutte">Tutte</option>
                {(Object.keys(CAT_LABELS) as CategoriaArticolo[]).map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unità operativa</label>
              <select className={selectCls} value={cfg.uo} onChange={(e) => setCfg({ ...cfg, uo: e.target.value })}>
                <option value="tutte">Tutte</option>
                {unita.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{tempo ? 'Ultimi periodi' : 'Quanti mostrare'}</label>
              <select className={selectCls} value={cfg.top} onChange={(e) => setCfg({ ...cfg, top: Number(e.target.value) })}>
                {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{tempo ? `Ultimi ${n}` : `Primi ${n}`}</option>)}
                <option value={0}>Tutti</option>
              </select>
            </div>
            {!tempo && (
              <div>
                <label className={labelCls}>Ordine</label>
                <select className={selectCls} value={cfg.ordine} onChange={(e) => setCfg({ ...cfg, ordine: e.target.value as 'desc' | 'asc' })}>
                  <option value="desc">Dal più alto</option>
                  <option value="asc">Dal più basso</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelCls}>Tipo di grafico</label>
              <div className="flex gap-1.5 flex-wrap">
                {TIPI.map((t) => (
                  <button key={t.id} type="button" onClick={() => setCfg({ ...cfg, tipo: t.id })}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      cfg.tipo === t.id ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {cfg.uo !== 'tutte' && misura.fonte === 'prodotti' && (
            <p className="text-xs text-ink-mute mt-3">
              Terapie e nutrizioni sono di tutta l’organizzazione (senza unità operativa): con una UO selezionata compaiono solo i prodotti assegnati a quella UO.
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-line">
            <p className="font-semibold text-ink mb-3">{titoloAuto}</p>
            <Grafico tipo={cfg.tipo} dati={dati} unita={misura.unita} />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Nome del grafico (es. ${titoloAuto})`}
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:border-forest"
            />
            <button type="button" onClick={salva} disabled={dati.length === 0} className="btn-primary justify-center">
              <Save className="w-4 h-4" /> Salva grafico
            </button>
          </div>
        </div>
      </div>

      {/* Grafici salvati */}
      {salvati.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1">I miei grafici</h2>
          <p className="text-xs text-ink-mute mb-3">Salvati su questo dispositivo; i dati si aggiornano da soli.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {salvati.map((s) => {
              const m = MISURE.find((x) => x.id === s.cfg.misura) ?? MISURE[0];
              return (
                <Scheda key={s.id} titolo={s.nome} sotto={`${m.label} per ${DIM_LABEL[s.cfg.dimensione].toLowerCase()}`}
                  azioni={
                    <button type="button" title="Elimina" onClick={() => persisti(salvati.filter((x) => x.id !== s.id))}
                      className="p-1.5 rounded-lg text-ink-mute hover:text-abx hover:bg-abx-soft transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  }>
                  <Grafico tipo={s.cfg.tipo} dati={calcola(s.cfg, prodotti, documenti, unita)} unita={m.unita} />
                </Scheda>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
