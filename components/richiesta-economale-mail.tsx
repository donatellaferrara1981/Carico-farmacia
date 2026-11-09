'use client';

import { useEffect, useState } from 'react';
import { InviaEmailIcon } from '@/components/invia-email-icon';
import { Plus, X } from 'lucide-react';

/* Mail precompilata di richiesta Economale.
   A: Luciana Sulfaro · CC: unità operativa richiedente + coordinatore Caminiti Angelo.
   Gli indirizzi si inseriscono una volta e restano salvati su questo dispositivo. */

const KEY = 'mail-economale-v1';
type Riga = { articolo: string; qta: string };
type Indirizzi = { sulfaro: string; caminiti: string; uo: Record<string, string> };

const VUOTI: Indirizzi = { sulfaro: '', caminiti: '', uo: {} };

function leggi(): Indirizzi {
  try { return { ...VUOTI, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return VUOTI; }
}

export function RichiestaEconomaleMail({
  uoNome, articoli, nomeRichiedente,
}: { uoNome: string; articoli: string[]; nomeRichiedente: string }) {
  const [open, setOpen] = useState(false);
  const [ind, setInd] = useState<Indirizzi>(VUOTI);
  const [righe, setRighe] = useState<Riga[]>([{ articolo: '', qta: '' }]);
  const [note, setNote] = useState('');

  useEffect(() => { setInd(leggi()); }, []);
  function salva(n: Indirizzi) {
    setInd(n);
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignora */ }
  }

  const mailUo = ind.uo[uoNome] ?? '';
  const piene = righe.filter((r) => r.articolo.trim());

  function apri() {
    const oggi = new Date().toLocaleDateString('it-IT');
    const elenco = piene.map((r, i) => `${i + 1}. ${r.articolo.trim()}${r.qta.trim() ? ` – quantità: ${r.qta.trim()}` : ''}`).join('\n');
    const corpo =
`Gentile Luciana Sulfaro,

si richiede la fornitura del seguente materiale economale per l'U.O. ${uoNome}:

${elenco}
${note.trim() ? `\nNote: ${note.trim()}\n` : ''}
Data richiesta: ${oggi}

Cordiali saluti
${nomeRichiedente}
U.O. ${uoNome}`;
    const cc = [mailUo, ind.caminiti].map((s) => s.trim()).filter(Boolean).join(',');
    const q = [`subject=${encodeURIComponent(`Richiesta materiale economale – ${uoNome} – ${oggi}`)}`];
    if (cc) q.push(`cc=${encodeURIComponent(cc)}`);
    q.push(`body=${encodeURIComponent(corpo)}`);
    window.location.href = `mailto:${encodeURIComponent(ind.sulfaro.trim())}?${q.join('&')}`;
  }

  const campo = 'w-full border border-line rounded-lg px-2.5 py-1.5 text-sm bg-bg-card';

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 text-ink-soft hover:text-forest transition-colors">
        <InviaEmailIcon /> Richiesta Economale
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-bg-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Richiesta Economale</h2>
              <button onClick={() => setOpen(false)} aria-label="Chiudi"><X className="w-5 h-5 text-ink-mute" /></button>
            </div>

            <div className="space-y-2 rounded-xl border border-line p-3 bg-bg-soft">
              <p className="text-xs font-medium text-ink-soft">Destinatari (salvati su questo dispositivo)</p>
              <label className="block text-xs text-ink-mute">A: Luciana Sulfaro
                <input className={campo} type="email" inputMode="email" placeholder="email" value={ind.sulfaro}
                  onChange={(e) => salva({ ...ind, sulfaro: e.target.value })} /></label>
              <label className="block text-xs text-ink-mute">CC: U.O. {uoNome}
                <input className={campo} type="email" inputMode="email" placeholder="email dell'unità operativa" value={mailUo}
                  onChange={(e) => salva({ ...ind, uo: { ...ind.uo, [uoNome]: e.target.value } })} /></label>
              <label className="block text-xs text-ink-mute">CC: Coordinatore Caminiti Angelo
                <input className={campo} type="email" inputMode="email" placeholder="email" value={ind.caminiti}
                  onChange={(e) => salva({ ...ind, caminiti: e.target.value })} /></label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-soft">Elenco articoli</p>
              <datalist id="art-economale">{articoli.map((a) => <option key={a} value={a} />)}</datalist>
              {righe.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input className={campo} list="art-economale" placeholder="Articolo (es. batterie AA)" value={r.articolo}
                    onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, articolo: e.target.value } : x))} />
                  <input className={`${campo} !w-20`} placeholder="Qtà" inputMode="numeric" value={r.qta}
                    onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, qta: e.target.value } : x))} />
                  {righe.length > 1 && (
                    <button onClick={() => setRighe(righe.filter((_, j) => j !== i))} aria-label="Rimuovi"><X className="w-4 h-4 text-ink-mute" /></button>
                  )}
                </div>
              ))}
              <button onClick={() => setRighe([...righe, { articolo: '', qta: '' }])}
                className="flex items-center gap-1 text-xs text-forest"><Plus className="w-3.5 h-3.5" /> Aggiungi articolo</button>
              <textarea className={campo} rows={2} placeholder="Note (facoltative)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <button onClick={apri} disabled={piene.length === 0}
              className="btn-primary w-full disabled:opacity-40">Apri mail precompilata</button>
            <p className="text-[11px] text-ink-mute text-center">Si apre il tuo programma di posta con testo e destinatari già inseriti: controlla e premi Invia.</p>
          </div>
        </div>
      )}
    </>
  );
}
