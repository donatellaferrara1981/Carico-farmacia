'use client';

import { useEffect, useState } from 'react';
import { InviaEmailIcon } from '@/components/invia-email-icon';
import { Plus, X } from 'lucide-react';

/* Mail precompilata di richiesta farmaco nominativo.
   A: Direzione di presidio + Farmacia
   CC: reparto richiedente, Melardi Sara, Tamara Longo, Ammendolia Ilaria, Valentina Isgro
   CCN: Caminiti Angelo, Tindara Santamaria, Carmen Cuscina, Daniela Sacca
   Gli indirizzi si inseriscono una volta e restano salvati su questo dispositivo. */

const KEY = 'mail-nominativa-v1';
const A = [['presidio', 'Direzione di presidio'], ['farmacia', 'Farmacia']] as const;
const CC = [['melardi', 'Melardi Sara'], ['longo', 'Tamara Longo'], ['ammendolia', 'Ammendolia Ilaria'], ['isgro', 'Valentina Isgro']] as const;
const CCN = [['caminiti', 'Caminiti Angelo'], ['santamaria', 'Tindara Santamaria'], ['cuscina', 'Carmen Cuscina'], ['sacca', 'Daniela Sacca']] as const;

type Ind = Record<string, string>;
type Riga = { paziente: string; farmaco: string; motivazione: string };

function leggi(): Ind { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } }
const lista = (ind: Ind, chiavi: readonly (readonly [string, string])[]) =>
  chiavi.map(([k]) => (ind[k] ?? '').trim()).filter(Boolean);

export function RichiestaNominativaMail({
  uoNome, farmaci, pazienti, nomeRichiedente,
}: { uoNome: string; farmaci: string[]; pazienti: string[]; nomeRichiedente: string }) {
  const [open, setOpen] = useState(false);
  const [ind, setInd] = useState<Ind>({});
  const [righe, setRighe] = useState<Riga[]>([{ paziente: '', farmaco: '', motivazione: '' }]);
  const [medico, setMedico] = useState('');

  useEffect(() => { setInd(leggi()); }, []);
  function set(k: string, v: string) {
    const n = { ...ind, [k]: v };
    setInd(n);
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignora */ }
  }
  const kUo = `uo:${uoNome}`;
  const piene = righe.filter((r) => r.farmaco.trim());

  function apri() {
    const oggi = new Date().toLocaleDateString('it-IT');
    const elenco = piene.map((r, i) =>
      `${i + 1}. ${r.farmaco.trim()}${r.paziente.trim() ? ` – paziente: ${r.paziente.trim()}` : ''}${r.motivazione.trim() ? `\n   Motivazione: ${r.motivazione.trim()}` : ''}`).join('\n');
    const corpo =
`Alla Direzione di Presidio e alla Farmacia,

si richiede l'autorizzazione alla fornitura nominativa dei seguenti farmaci per l'U.O. ${uoNome}:

${elenco}
${medico.trim() ? `\nMedico richiedente: ${medico.trim()}\n` : ''}
Si allega la richiesta cartacea firmata dal medico.

Data richiesta: ${oggi}

Cordiali saluti
${nomeRichiedente}
U.O. ${uoNome}`;
    const to = lista(ind, A).join(',');
    const cc = [...(ind[kUo]?.trim() ? [ind[kUo].trim()] : []), ...lista(ind, CC)].join(',');
    const bcc = lista(ind, CCN).join(',');
    const q = [`subject=${encodeURIComponent(`Richiesta farmaco nominativo – ${uoNome} – ${oggi}`)}`];
    if (cc) q.push(`cc=${encodeURIComponent(cc)}`);
    if (bcc) q.push(`bcc=${encodeURIComponent(bcc)}`);
    q.push(`body=${encodeURIComponent(corpo)}`);
    window.location.href = `mailto:${encodeURIComponent(to)}?${q.join('&')}`;
  }

  const campo = 'w-full border border-line rounded-lg px-2.5 py-1.5 text-sm bg-bg-card';
  const gruppo = (titolo: string, voci: readonly (readonly [string, string])[]) => (
    <>
      <p className="text-xs font-semibold text-ink-soft pt-1">{titolo}</p>
      {voci.map(([k, nome]) => (
        <label key={k} className="block text-xs text-ink-mute">{nome}
          <input className={campo} type="email" inputMode="email" placeholder="email" value={ind[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
    </>
  );

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 text-ink-soft hover:text-forest transition-colors">
        <InviaEmailIcon /> Richiesta nominativa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-bg-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Richiesta farmaco nominativo</h2>
              <button onClick={() => setOpen(false)} aria-label="Chiudi"><X className="w-5 h-5 text-ink-mute" /></button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-soft">Farmaci da richiedere</p>
              <datalist id="nom-farmaci">{farmaci.map((a) => <option key={a} value={a} />)}</datalist>
              <datalist id="nom-pazienti">{pazienti.map((a) => <option key={a} value={a} />)}</datalist>
              {righe.map((r, i) => (
                <div key={i} className="rounded-xl border border-line p-2 space-y-1.5">
                  <div className="flex gap-2">
                    <input className={campo} list="nom-farmaci" placeholder="Farmaco e dosaggio" value={r.farmaco}
                      onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, farmaco: e.target.value } : x))} />
                    {righe.length > 1 && <button onClick={() => setRighe(righe.filter((_, j) => j !== i))} aria-label="Rimuovi"><X className="w-4 h-4 text-ink-mute" /></button>}
                  </div>
                  <input className={campo} list="nom-pazienti" placeholder="Paziente" value={r.paziente}
                    onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, paziente: e.target.value } : x))} />
                  <input className={campo} placeholder="Motivazione clinica (facoltativa)" value={r.motivazione}
                    onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, motivazione: e.target.value } : x))} />
                </div>
              ))}
              <button onClick={() => setRighe([...righe, { paziente: '', farmaco: '', motivazione: '' }])}
                className="flex items-center gap-1 text-xs text-forest"><Plus className="w-3.5 h-3.5" /> Aggiungi farmaco</button>
              <input className={campo} placeholder="Medico richiedente" value={medico} onChange={(e) => setMedico(e.target.value)} />
            </div>

            <details className="rounded-xl border border-line p-3 bg-bg-soft">
              <summary className="text-xs font-medium text-ink-soft cursor-pointer">Indirizzi destinatari (salvati su questo dispositivo)</summary>
              <div className="space-y-2 mt-2">
                {gruppo('A', A)}
                <p className="text-xs font-semibold text-ink-soft pt-1">CC</p>
                <label className="block text-xs text-ink-mute">Reparto richiedente: {uoNome}
                  <input className={campo} type="email" inputMode="email" placeholder="email dell'unità operativa" value={ind[kUo] ?? ''} onChange={(e) => set(kUo, e.target.value)} /></label>
                {CC.map(([k, nome]) => (
                  <label key={k} className="block text-xs text-ink-mute">{nome}
                    <input className={campo} type="email" inputMode="email" placeholder="email" value={ind[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></label>
                ))}
                {gruppo('CCN (copia nascosta)', CCN)}
              </div>
            </details>

            <button onClick={apri} disabled={piene.length === 0} className="btn-primary w-full disabled:opacity-40">Apri mail precompilata</button>
            <p className="text-[11px] text-ink-mute text-center">Si apre il tuo programma di posta. <b>Allega a mano i documenti firmati dal medico</b> prima di premere Invia: dal link non si possono allegare file.</p>
          </div>
        </div>
      )}
    </>
  );
}
