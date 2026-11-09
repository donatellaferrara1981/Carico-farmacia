'use client';

import { useRef, useState, useTransition } from 'react';
import { Plus, Loader2, AlertCircle, FileUp } from 'lucide-react';
import { ArchivioRelazioni, type RelazioneArchiviata } from '@/components/archivio-relazioni';
import { archiviaRelazioneManualeAction, archiviaRelazionePdfAction } from '@/app/(app)/relazioni/actions';

const FILTRI = [
  { id: 'tutte', label: 'Tutte' },
  { id: 'ica', label: 'ICA' },
  { id: 'paca', label: 'PACA' },
  { id: 'antibiotici', label: 'Antibiotici' },
  { id: 'altro', label: 'Altre' },
] as const;

export function ArchivioPagina({ orgId, relazioni }: { orgId: string; relazioni: RelazioneArchiviata[] }) {
  const [filtro, setFiltro] = useState<(typeof FILTRI)[number]['id']>('tutte');
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [testo, setTesto] = useState('');
  const [eHtml, setEHtml] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const visibili = filtro === 'tutte' ? relazioni : relazioni.filter((r) => r.tipo === filtro);
  const conta = (id: string) => (id === 'tutte' ? relazioni.length : relazioni.filter((r) => r.tipo === id).length);

  async function leggiFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErrore(null);
    const nome = f.name.toLowerCase();
    if (nome.endsWith('.pdf')) {
      if (f.size > 4_000_000) { setErrore('PDF troppo grande (massimo 4 MB).'); return; }
      setPdf(f); setTesto(''); setEHtml(false);
      if (!titolo) setTitolo(f.name.replace(/\.[^.]+$/, ''));
      return;
    }
    if (f.size > 1_500_000) { setErrore('File troppo grande (massimo 1,5 MB).'); return; }
    if (!/\.(txt|html?|md)$/.test(nome)) { setErrore('Sono supportati PDF, .txt, .html e .md.'); return; }
    setPdf(null);
    setTesto(await f.text());
    setEHtml(/\.html?$/.test(nome));
    if (!titolo) setTitolo(f.name.replace(/\.[^.]+$/, ''));
  }

  function salva() {
    setErrore(null);
    start(async () => {
      let res;
      if (pdf) {
        const fd = new FormData();
        fd.append('file', pdf); fd.append('org_id', orgId); fd.append('titolo', titolo); fd.append('periodo', periodo);
        res = await archiviaRelazionePdfAction(fd);
      } else {
        res = await archiviaRelazioneManualeAction(orgId, titolo, periodo || null, testo, eHtml);
      }
      if ('error' in res && res.error) { setErrore(res.error); return; }
      setTitolo(''); setPeriodo(''); setTesto(''); setEHtml(false); setPdf(null); setAperto(false);
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  const input = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:border-forest';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {FILTRI.map((f) => (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                filtro === f.id ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'
              }`}>
              {f.label} <span className="opacity-70">{conta(f.id)}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAperto(!aperto)} className="btn-primary ml-auto text-sm">
          <Plus className="w-4 h-4" /> Nuova relazione
        </button>
      </div>

      {aperto && (
        <div className="card space-y-3">
          <p className="text-sm text-ink-soft">
            Archivia una relazione: carica un PDF (massimo 4 MB) oppure un file .txt/.html, o incolla il testo. Le relazioni ICA e PACA
            si archiviano dalle rispettive pagine con il pulsante «Archivia».
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Titolo *" value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={200} />
            <input className={input} placeholder="Periodo (facoltativo)" value={periodo} onChange={(e) => setPeriodo(e.target.value)} maxLength={100} />
          </div>
          {pdf ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 py-2 text-sm">
              <FileUp className="w-4 h-4 text-forest shrink-0" />
              <span className="truncate flex-1">{pdf.name}</span>
              <button type="button" onClick={() => { setPdf(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="text-xs text-abx underline">Rimuovi</button>
            </div>
          ) : (
            <textarea className={`${input} min-h-[160px]`} placeholder="Testo della relazione" value={testo}
              onChange={(e) => { setTesto(e.target.value); setEHtml(false); }} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
              <FileUp className="w-4 h-4" /> Carica file
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.html,.htm,.md,application/pdf,text/plain,text/html" className="hidden" onChange={leggiFile} />
            <button type="button" onClick={salva} disabled={salvando} className="btn-primary text-sm ml-auto">
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvo…</> : 'Archivia'}
            </button>
          </div>
          {errore && (
            <p className="flex items-center gap-1 text-xs text-abx"><AlertCircle className="w-3.5 h-3.5" /> {errore}</p>
          )}
        </div>
      )}

      <ArchivioRelazioni relazioni={visibili} />
    </div>
  );
}
