'use client';

import { useState, useTransition } from 'react';
import { Printer, Plus, Trash2, Pencil, Check, X, AlertTriangle, FlaskConical, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { aggiungiEsameIcaAction, aggiornaEsameIcaAction, eliminaEsameIcaAction } from '@/app/(app)/report-ica/actions';

interface EsameIca {
  id: string;
  paziente: string;
  tipologia_esame: string;
  data_invio: string | null;
  data_referto: string | null;
  risultato: string | null;
  note: string | null;
}

interface Props {
  esami: EsameIca[];
  orgId: string;
  orgName: string;
  userName: string;
}

const TIPI_ESAME = [
  'Emocoltura',
  'Urinocoltura',
  'BAL',
  'Esame tracheoaspirato',
  'Broncoaspirato',
  'Tampone vaginale',
  'Tampone uretrale',
  'Tampone nasale',
  'Tampone rettale',
  'Tampone profondo',
  'Liquido pleurico',
  'Toracentesi',
  'Colture ingresso',
  'Escreato',
  'Emocoltura + Urinocoltura',
  'Altro',
];

const MESI_LABEL = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const MESI_FULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function isPositivo(risultato: string | null): boolean | null {
  if (!risultato) return null;
  const r = risultato.toLowerCase();
  if (r.includes('negativ')) return false;
  if (r.includes('rifiut') || r.includes('non invi')) return null;
  return true;
}

export function ReportIcaView({ esami: esaGlobali, orgId, orgName, userName }: Props) {
  const now = new Date();
  const [esami, setEsami] = useState<EsameIca[]>(esaGlobali);
  const [annoFiltro, setAnnoFiltro] = useState(String(now.getFullYear()));
  const [meseFiltro, setMeseFiltro] = useState('');
  const [pazienteFiltro, setPazienteFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [risultatoFiltro, setRisultatoFiltro] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const anni = [...new Set(esami.map((e) => e.data_invio?.slice(0, 4)).filter(Boolean))].sort().reverse() as string[];
  if (!anni.includes(String(now.getFullYear()))) anni.unshift(String(now.getFullYear()));

  const pazienti = [...new Set(esami.map((e) => e.paziente))].sort();
  const tipi = [...new Set(esami.map((e) => e.tipologia_esame))].sort();

  const filtrati = esami.filter((e) => {
    if (annoFiltro && !(e.data_invio ?? '').startsWith(annoFiltro)) return false;
    if (meseFiltro && !(e.data_invio ?? '').startsWith(`${annoFiltro}-${meseFiltro.padStart(2, '0')}`)) return false;
    if (pazienteFiltro && e.paziente !== pazienteFiltro) return false;
    if (tipoFiltro && e.tipologia_esame !== tipoFiltro) return false;
    if (risultatoFiltro === 'positivo' && isPositivo(e.risultato) !== true) return false;
    if (risultatoFiltro === 'negativo' && isPositivo(e.risultato) !== false) return false;
    if (risultatoFiltro === 'attesa' && e.risultato !== null) return false;
    return true;
  });

  // KPI
  const positivi = filtrati.filter((e) => isPositivo(e.risultato) === true).length;
  const negativi = filtrati.filter((e) => isPositivo(e.risultato) === false).length;
  const inAttesa = filtrati.filter((e) => !e.risultato).length;

  // Distribuzione per tipo
  const perTipo: Record<string, number> = {};
  for (const e of filtrati) {
    perTipo[e.tipologia_esame] = (perTipo[e.tipologia_esame] ?? 0) + 1;
  }
  const tipiOrd = Object.entries(perTipo).sort((a, b) => b[1] - a[1]);

  // Patogeni più frequenti
  const patogeni: Record<string, number> = {};
  for (const e of filtrati) {
    if (e.risultato && isPositivo(e.risultato) === true) {
      const r = e.risultato.replace(/\(da verificare\)/gi, '').trim();
      patogeni[r] = (patogeni[r] ?? 0) + 1;
    }
  }
  const patogeniOrd = Object.entries(patogeni).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Trend mensile
  const perMese: Record<string, { totale: number; positivi: number }> = {};
  for (const e of esami) {
    if (!e.data_invio) continue;
    const mese = e.data_invio.slice(0, 7);
    if (!perMese[mese]) perMese[mese] = { totale: 0, positivi: 0 };
    perMese[mese].totale++;
    if (isPositivo(e.risultato) === true) perMese[mese].positivi++;
  }
  const mesiOrd = Object.keys(perMese).sort().slice(-12);
  const maxTotale = Math.max(...mesiOrd.map((m) => perMese[m].totale), 1);

  function stampaReport() {
    const righe = filtrati.map((e) => {
      const pos = isPositivo(e.risultato);
      const colore = pos === true ? '#dc2626' : pos === false ? '#065f46' : '#6b7280';
      return `<tr>
        <td><strong>${e.paziente}</strong></td>
        <td>${e.tipologia_esame}</td>
        <td>${e.data_invio ? new Date(e.data_invio).toLocaleDateString('it-IT') : '—'}</td>
        <td>${e.data_referto ? new Date(e.data_referto).toLocaleDateString('it-IT') : '—'}</td>
        <td style="color:${colore};font-weight:${pos === true ? 'bold' : 'normal'}">${e.risultato ?? 'In attesa'}</td>
        <td>${e.note ?? ''}</td>
      </tr>`;
    }).join('');
    const periodo = meseFiltro
      ? `${MESI_FULL[parseInt(meseFiltro) - 1]} ${annoFiltro}`
      : annoFiltro ? `Anno ${annoFiltro}` : 'Tutti i periodi';
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<title>Report ICA — ${orgName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:24px;font-size:11px}
h1{font-size:16px;font-weight:700;color:#1f3d2b;margin-bottom:4px}
.sub{font-size:10px;color:#6b7280;margin-bottom:16px}
.kpi{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.kpi div{border:1px solid #e5e7eb;border-radius:6px;padding:8px 14px}
.kpi .v{font-size:20px;font-weight:700}.kpi .l{font-size:9px;color:#6b7280}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{background:#f3f4f6;padding:5px 8px;text-align:left;font-size:10px;font-weight:600}
td{padding:4px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;vertical-align:top}
.footer{font-size:9px;color:#9ca3af;text-align:right;margin-top:16px}
@media print{@page{size:A4 landscape;margin:1cm}body{padding:0}}</style></head><body>
<h1>Sorveglianza ICA — ${orgName}</h1>
<div class="sub">Periodo: ${periodo} · ${pazienteFiltro || 'Tutti i pazienti'} · Stampato il ${new Date().toLocaleString('it-IT')} da ${userName}</div>
<div class="kpi">
  <div><div class="v">${filtrati.length}</div><div class="l">Totale esami</div></div>
  <div><div class="v" style="color:#dc2626">${positivi}</div><div class="l">Positivi</div></div>
  <div><div class="v" style="color:#065f46">${negativi}</div><div class="l">Negativi</div></div>
  <div><div class="v" style="color:#d97706">${inAttesa}</div><div class="l">In attesa referto</div></div>
  ${filtrati.length > 0 ? `<div><div class="v">${Math.round((positivi/filtrati.length)*100)}%</div><div class="l">% positività</div></div>` : ''}
</div>
<table><thead><tr><th>Paziente</th><th>Tipo esame</th><th>Data invio</th><th>Data referto</th><th>Risultato</th><th>Note</th></tr></thead>
<tbody>${righe || '<tr><td colspan="6" style="text-align:center;color:#9ca3af">Nessun esame nel periodo</td></tr>'}</tbody></table>
<div class="footer">${orgName} · Report ICA · Gestionale Infermieristico</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) w.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url); });
  }

  return (
    <div className="space-y-6">
      {/* Filtri */}
      <div className="card flex flex-wrap items-center gap-2">
        <select value={annoFiltro} onChange={(e) => setAnnoFiltro(e.target.value)} className="input-base text-sm py-1 w-24">
          <option value="">Tutti</option>
          {anni.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={meseFiltro} onChange={(e) => setMeseFiltro(e.target.value)} className="input-base text-sm py-1 w-32" disabled={!annoFiltro}>
          <option value="">Tutti i mesi</option>
          {MESI_FULL.map((m, i) => <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        <select value={pazienteFiltro} onChange={(e) => setPazienteFiltro(e.target.value)} className="input-base text-sm py-1 w-40">
          <option value="">Tutti i pazienti</option>
          {pazienti.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="input-base text-sm py-1 w-44">
          <option value="">Tutti i tipi</option>
          {tipi.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={risultatoFiltro} onChange={(e) => setRisultatoFiltro(e.target.value)} className="input-base text-sm py-1 w-36">
          <option value="">Tutti i risultati</option>
          <option value="positivo">Positivi</option>
          <option value="negativo">Negativi</option>
          <option value="attesa">In attesa</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-ink-mute">{filtrati.length} esami</span>
          <button onClick={stampaReport} className="btn-primary text-xs py-1.5 flex items-center gap-1">
            <Printer className="w-3.5 h-3.5" /> Stampa
          </button>
          <button onClick={() => setShowAddForm(true)} className="btn-primary text-xs py-1.5 flex items-center gap-1 bg-forest/80">
            <Plus className="w-3.5 h-3.5" /> Aggiungi
          </button>
        </div>
      </div>

      {/* Form aggiungi esame */}
      {showAddForm && (
        <AggiungiEsameForm orgId={orgId} onClose={() => setShowAddForm(false)}
          onAdded={(e) => { setEsami((prev) => [e, ...prev]); setShowAddForm(false); }} />
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card flex flex-col gap-1">
          <span className="text-xs text-ink-mute flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" /> Totale esami</span>
          <span className="text-2xl font-bold text-ink">{filtrati.length}</span>
        </div>
        <div className="card flex flex-col gap-1">
          <span className="text-xs text-ink-mute flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Positivi</span>
          <span className="text-2xl font-bold text-red-600">{positivi}</span>
          {filtrati.length > 0 && <span className="text-xs text-ink-mute">{Math.round((positivi/filtrati.length)*100)}% degli esami</span>}
        </div>
        <div className="card flex flex-col gap-1">
          <span className="text-xs text-ink-mute flex items-center gap-1"><Check className="w-3.5 h-3.5 text-forest" /> Negativi</span>
          <span className="text-2xl font-bold text-forest">{negativi}</span>
        </div>
        <div className="card flex flex-col gap-1">
          <span className="text-xs text-ink-mute">In attesa referto</span>
          <span className="text-2xl font-bold text-amber">{inAttesa}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend mensile */}
        {mesiOrd.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-ink mb-3">Andamento mensile</h2>
            <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 80 }}>
              {mesiOrd.map((mese) => {
                const d = perMese[mese];
                const hTot = Math.round((d.totale / maxTotale) * 70);
                const hPos = Math.round((d.positivi / maxTotale) * 70);
                const [y, m] = mese.split('-');
                return (
                  <div key={mese} className="flex flex-col items-center gap-0.5 shrink-0">
                    <span className="text-[9px] text-red-500 font-semibold">{d.positivi > 0 ? d.positivi : ''}</span>
                    <div className="flex items-end gap-0.5 h-[70px]">
                      <div className="w-5 bg-line/50 rounded-t" style={{ height: `${hTot}px`, minHeight: 3 }} />
                      <div className="w-5 bg-red-400/70 rounded-t" style={{ height: `${hPos}px`, minHeight: hPos > 0 ? 3 : 0 }} />
                    </div>
                    <span className="text-[8px] text-ink-mute">{MESI_LABEL[parseInt(m)-1]}</span>
                    <span className="text-[8px] text-ink-mute">{y.slice(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-1 text-[10px] text-ink-mute">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-line/50 inline-block" /> Totale</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400/70 inline-block" /> Positivi</span>
            </div>
          </div>
        )}

        {/* Distribuzione per tipo */}
        <div className="card">
          <h2 className="text-sm font-semibold text-ink mb-3">Per tipologia di esame</h2>
          <div className="space-y-1.5">
            {tipiOrd.slice(0, 8).map(([tipo, cnt]) => (
              <div key={tipo}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-ink truncate flex-1 mr-2">{tipo}</span>
                  <span className="font-semibold text-ink-soft shrink-0">{cnt}</span>
                </div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-forest/50 rounded-full" style={{ width: `${Math.round((cnt/filtrati.length)*100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patogeni più frequenti */}
      {patogeniOrd.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Patogeni isolati più frequenti
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {patogeniOrd.map(([pat, cnt]) => (
              <div key={pat} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <span className="text-xs text-ink font-medium">{pat}</span>
                <span className="text-xs font-bold text-red-600 ml-2 shrink-0">{cnt}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabella esami */}
      <div className="card">
        <h2 className="text-sm font-semibold text-ink mb-3">Registro esami ({filtrati.length})</h2>
        {filtrati.length === 0 ? (
          <p className="text-sm text-ink-mute text-center py-8">Nessun esame nel periodo selezionato.</p>
        ) : (
          <div className="space-y-1">
            {filtrati.map((e) => (
              <RigaEsame key={e.id} esame={e}
                onUpdated={(upd) => setEsami((prev) => prev.map((x) => x.id === upd.id ? upd : x))}
                onDeleted={(id) => setEsami((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Form aggiungi esame ───────────────────────────────────────────────────────

function AggiungiEsameForm({ orgId, onClose, onAdded }: {
  orgId: string;
  onClose: () => void;
  onAdded: (e: EsameIca) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [paziente, setPaziente] = useState('');
  const [tipo, setTipo] = useState('Emocoltura');
  const [tipoCustom, setTipoCustom] = useState('');
  const [dataInvio, setDataInvio] = useState('');
  const [dataReferto, setDataReferto] = useState('');
  const [risultato, setRisultato] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paziente.trim()) { setErr('Inserire il nominativo del paziente.'); return; }
    const tipoFinale = tipo === 'Altro' ? tipoCustom.trim() : tipo;
    if (!tipoFinale) { setErr('Inserire il tipo di esame.'); return; }
    setErr('');
    startTransition(async () => {
      const res = await aggiungiEsameIcaAction(orgId, paziente, tipoFinale, dataInvio || null, dataReferto || null, risultato || null, note || null);
      if (res.error) { setErr(res.error); return; }
      onAdded({
        id: crypto.randomUUID(),
        paziente: paziente.trim().toUpperCase(),
        tipologia_esame: tipoFinale,
        data_invio: dataInvio || null,
        data_referto: dataReferto || null,
        risultato: risultato || null,
        note: note || null,
      });
    });
  }

  return (
    <div className="card border-forest/30 bg-forest/5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Nuovo esame ICA</p>
        <button onClick={onClose} className="text-ink-mute hover:text-ink"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <label className="text-[10px] text-ink-mute block mb-0.5">Paziente *</label>
            <input type="text" value={paziente} onChange={(e) => setPaziente(e.target.value.toUpperCase())} placeholder="COGNOME NOME" className="input-base text-xs py-1 w-full uppercase" />
          </div>
          <div>
            <label className="text-[10px] text-ink-mute block mb-0.5">Tipo esame *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-base text-xs py-1 w-full">
              {TIPI_ESAME.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {tipo === 'Altro' && (
            <div className="sm:col-span-2">
              <label className="text-[10px] text-ink-mute block mb-0.5">Specifica tipo</label>
              <input type="text" value={tipoCustom} onChange={(e) => setTipoCustom(e.target.value)} className="input-base text-xs py-1 w-full" />
            </div>
          )}
          <div>
            <label className="text-[10px] text-ink-mute block mb-0.5">Data invio</label>
            <input type="date" value={dataInvio} onChange={(e) => setDataInvio(e.target.value)} className="input-base text-xs py-1 w-full" />
          </div>
          <div>
            <label className="text-[10px] text-ink-mute block mb-0.5">Data referto</label>
            <input type="date" value={dataReferto} onChange={(e) => setDataReferto(e.target.value)} className="input-base text-xs py-1 w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-ink-mute block mb-0.5">Risultato</label>
            <input type="text" value={risultato} onChange={(e) => setRisultato(e.target.value)} placeholder="Es: Negativa / E. coli / Klebsiella pneumoniae" className="input-base text-xs py-1 w-full" />
          </div>
          <div>
            <label className="text-[10px] text-ink-mute block mb-0.5">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Osservazioni…" className="input-base text-xs py-1 w-full" />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary text-xs py-1.5 flex items-center gap-1">
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Salva esame
          </button>
          <button type="button" onClick={onClose} className="text-xs text-ink-mute hover:text-ink px-3 py-1.5 border border-line rounded">Annulla</button>
        </div>
      </form>
    </div>
  );
}

// ── Riga esame singolo ────────────────────────────────────────────────────────

function RigaEsame({ esame: e, onUpdated, onDeleted }: {
  esame: EsameIca;
  onUpdated: (e: EsameIca) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [risultato, setRisultato] = useState(e.risultato ?? '');
  const [dataReferto, setDataReferto] = useState(e.data_referto ?? '');
  const [note, setNote] = useState(e.note ?? '');

  const pos = isPositivo(e.risultato);
  const badgeColor = pos === true ? 'bg-red-50 text-red-700 border-red-200' : pos === false ? 'bg-forest/10 text-forest border-forest/20' : 'bg-amber/10 text-amber border-amber/20';
  const badgeLabel = pos === true ? 'POSITIVO' : pos === false ? 'Negativo' : 'In attesa';

  function handleSave() {
    startTransition(async () => {
      const res = await aggiornaEsameIcaAction(e.id, risultato || null, dataReferto || null, note || null);
      if (!res.error) {
        onUpdated({ ...e, risultato: risultato || null, data_referto: dataReferto || null, note: note || null });
        setEditing(false);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Eliminare l'esame di ${e.paziente}?`)) return;
    startTransition(async () => {
      await eliminaEsameIcaAction(e.id);
      onDeleted(e.id);
    });
  }

  return (
    <div className={`rounded-lg border transition-colors ${pos === true ? 'border-red-100 bg-red-50/30' : 'border-line'}`}>
      {/* Riga compatta */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-ink">{e.paziente}</span>
            <span className="text-[10px] text-ink-soft bg-line/40 px-1.5 py-0.5 rounded">{e.tipologia_esame}</span>
            {e.data_invio && <span className="text-[10px] text-ink-mute">{new Date(e.data_invio).toLocaleDateString('it-IT')}</span>}
            {e.data_referto && <span className="text-[10px] text-ink-mute">→ ref. {new Date(e.data_referto).toLocaleDateString('it-IT')}</span>}
          </div>
          {!editing && e.risultato && (
            <p className={`text-[11px] mt-0.5 font-medium ${pos === true ? 'text-red-600' : pos === false ? 'text-forest' : 'text-amber'}`}>
              {e.risultato}
            </p>
          )}
          {!editing && e.note && <p className="text-[10px] text-ink-mute mt-0.5 italic">{e.note}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>{badgeLabel}</span>
          <button onClick={() => setEditing(!editing)} className="text-ink-mute hover:text-forest p-0.5">
            {editing ? <ChevronUp className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleDelete} disabled={pending} className="text-ink-mute hover:text-red-500 p-0.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Form modifica inline */}
      {editing && (
        <div className="border-t border-line bg-bg-soft/40 px-3 py-2 space-y-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-ink-mute block mb-0.5">Risultato</label>
              <input type="text" value={risultato} onChange={(ev) => setRisultato(ev.target.value)} placeholder="Es: Negativa / Klebsiella pneumoniae" className="input-base text-xs py-1 w-full" />
            </div>
            <div>
              <label className="text-[10px] text-ink-mute block mb-0.5">Data referto</label>
              <input type="date" value={dataReferto} onChange={(ev) => setDataReferto(ev.target.value)} className="input-base text-xs py-1 w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-ink-mute block mb-0.5">Note</label>
              <input type="text" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Osservazioni…" className="input-base text-xs py-1 w-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={pending} className="btn-primary text-xs py-1 flex items-center gap-1">
              {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salva
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-ink-mute hover:text-ink border border-line rounded px-2 py-1">Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
