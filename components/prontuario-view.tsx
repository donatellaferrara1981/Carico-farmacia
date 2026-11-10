'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { Search, Send, Loader2, BookOpen, AlertTriangle, FileSignature, Users, Sparkles } from 'lucide-react';
import type { VoceProntuario } from '@/lib/prontuario';
import { classificaFarmaco, isAltoCosto, CLASSE_LABEL } from '@/lib/antibiotici';
import { CLASSI_FORMA, classeForma, isIntegratore } from '@/lib/classifica-consumo';
import { chiediProntuarioAction, type MessaggioChat, type FonteChat } from '@/app/(app)/prontuario/chiedi-action';

type Filtro = 'tutti' | 'abx' | 'costo' | 'nominative' | 'reparto' | 'integratori';
const FILTRI: { id: Filtro; label: string }[] = [
  { id: 'tutti', label: 'Tutti' }, { id: 'reparto', label: 'In reparto' }, { id: 'abx', label: 'Antibiotici' },
  { id: 'costo', label: 'Alto costo' }, { id: 'nominative', label: 'Nominative' }, { id: 'integratori', label: 'Integratori' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface Gruppo {
  principio: string;
  varianti: { dosaggio: string; nome: string; forma: string }[];
  classeFarm: string | null;
  abx: boolean; costo: boolean; nominativa: boolean; integratore: boolean; pazienti: number;
}

type Msg = MessaggioChat & { fonti?: FonteChat[] };

export function ProntuarioView({ voci }: { voci: VoceProntuario[] }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('tutti');
  const [chat, setChat] = useState<Msg[]>([]);
  const [domanda, setDomanda] = useState('');
  const [pending, start] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const gruppi = useMemo(() => {
    const m = new Map<string, Gruppo>();
    for (const v of voci) {
      const k = norm(v.principio_attivo.trim());
      const info = classificaFarmaco(v.principio_attivo);
      const g = m.get(k) ?? {
        principio: v.principio_attivo.trim(), varianti: [], classeFarm: info.classe ? CLASSE_LABEL[info.classe] : null,
        abx: info.isAntibiotico, costo: isAltoCosto(v.principio_attivo), nominativa: false, integratore: false, pazienti: 0,
      };
      const forma = CLASSI_FORMA.find((c) => c.id === classeForma(v))?.label ?? '';
      g.varianti.push({ dosaggio: v.dosaggio ?? '', nome: v.nome_commerciale ?? '', forma });
      g.nominativa ||= v.nominativa;
      g.integratore ||= isIntegratore(v);
      g.pazienti += v.pazienti;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => a.principio.localeCompare(b.principio, 'it'));
  }, [voci]);

  const visibili = useMemo(() => {
    const t = norm(q.trim());
    return gruppi.filter((g) => {
      if (filtro === 'abx' && !g.abx) return false;
      if (filtro === 'costo' && !g.costo) return false;
      if (filtro === 'nominative' && !g.nominativa) return false;
      if (filtro === 'reparto' && g.pazienti === 0) return false;
      if (filtro === 'integratori' && !g.integratore) return false;
      if (!t) return true;
      return norm(g.principio).includes(t) || (g.classeFarm && norm(g.classeFarm).includes(t)) ||
        g.varianti.some((v) => norm(v.nome).includes(t) || norm(v.dosaggio).includes(t));
    });
  }, [gruppi, q, filtro]);

  function invia(testo: string) {
    const t = testo.trim();
    if (!t || pending) return;
    const nuova: Msg[] = [...chat, { ruolo: 'utente', testo: t }];
    setChat(nuova);
    setDomanda('');
    setErrore(null);
    start(async () => {
      const r = await chiediProntuarioAction(nuova.map(({ ruolo, testo }) => ({ ruolo, testo })));
      if (r.error) setErrore(r.error);
      else setChat((c) => [...c, { ruolo: 'assistente', testo: r.testo ?? '', fonti: r.fonti }]);
      setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });
  }

  return (
    <div className="space-y-5 mt-4">
      {/* Chiedi */}
      <section ref={chatRef} className="rounded-2xl border border-forest/30 bg-forest/5 p-3 sm:p-4 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="w-4 h-4 text-forest" /> Chiedi al prontuario</h2>
        {chat.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {['Cosa abbiamo in reparto per la stipsi?', 'Interazioni tra i farmaci dello stesso paziente: cosa controllare?', 'Quali antibiotici richiedono prescrizione motivata?'].map((s) => (
              <button key={s} onClick={() => invia(s)} className="text-xs px-2.5 py-1 rounded-full border border-line bg-bg-card text-ink-soft hover:border-forest/40">{s}</button>
            ))}
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={m.ruolo === 'utente' ? 'text-right' : ''}>
            <div className={`inline-block max-w-full text-left text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${m.ruolo === 'utente' ? 'bg-forest text-white' : 'bg-bg-card border border-line text-ink'}`}>
              {m.testo}
              {m.fonti && m.fonti.length > 0 && (
                <div className="mt-2 pt-2 border-t border-line text-xs text-ink-mute">
                  Fonti: {m.fonti.map((f, j) => (
                    <a key={j} href={f.url} target="_blank" rel="noreferrer" className="underline mr-2 break-all">{f.titolo}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="flex items-center gap-2 text-xs text-ink-mute"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consulto catalogo e fonti AIFA…</p>}
        {errore && <p className="text-xs text-red-600">{errore}</p>}
        <form onSubmit={(e) => { e.preventDefault(); invia(domanda); }} className="flex gap-2">
          <input value={domanda} onChange={(e) => setDomanda(e.target.value)} placeholder="Scrivi una domanda sui farmaci…"
            className="flex-1 min-w-0 rounded-xl border border-line bg-bg-card px-3 py-2 text-sm" />
          <button disabled={pending || !domanda.trim()} className="px-3 rounded-xl bg-forest text-white disabled:opacity-50"><Send className="w-4 h-4" /></button>
        </form>
        <p className="text-[11px] text-ink-mute">Supporto informativo da catalogo del reparto e fonti ufficiali (AIFA, EMA): non sostituisce il parere del medico o del farmacista.</p>
      </section>

      {/* Ricerca */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca principio attivo, nome commerciale, classe…"
            className="w-full rounded-xl border border-line bg-bg-card pl-9 pr-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTRI.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filtro === f.id ? 'bg-forest text-white border-forest' : 'bg-bg-soft text-ink-mute border-line hover:border-forest/40'}`}>{f.label}</button>
          ))}
        </div>
        <p className="text-xs text-ink-mute">{visibili.length} farmaci</p>
      </div>

      {visibili.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-mute text-sm">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />Nessun farmaco trovato.
        </div>
      ) : (
        <ul className="rounded-xl border border-line bg-bg-card divide-y divide-line">
          {visibili.map((g) => (
            <li key={g.principio} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`font-semibold text-ink ${g.costo ? 'underline decoration-amber decoration-2 underline-offset-2' : ''}`}>{g.principio}</span>
                {g.classeFarm && <span className="text-[11px] px-2 py-0.5 rounded-full bg-abx-soft text-abx border border-abx/30">{g.classeFarm}</span>}
                {g.costo && <span className="inline-flex items-center gap-1 text-[11px] text-amber"><AlertTriangle className="w-3 h-3" /> prescrizione motivata</span>}
                {g.nominativa && <span className="inline-flex items-center gap-1 text-[11px] text-abx"><FileSignature className="w-3 h-3" /> nominativa</span>}
                {g.integratore && <span className="text-[11px] text-ink-mute">integratore</span>}
                {g.pazienti > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-forest"><Users className="w-3 h-3" /> {g.pazienti}</span>}
                <button onClick={() => invia(`Scheda sintetica di ${g.principio}: indicazioni, controindicazioni, interazioni principali e avvertenze, da fonti AIFA.`)}
                  className="ml-auto text-[11px] px-2 py-0.5 rounded-lg border border-line text-ink-soft hover:text-forest hover:border-forest/40">Scheda</button>
              </div>
              <p className="text-xs text-ink-mute mt-0.5">
                {g.varianti.map((v) => [v.dosaggio, v.nome && `(${v.nome})`, v.forma && `· ${v.forma}`].filter(Boolean).join(' ')).join(' | ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
