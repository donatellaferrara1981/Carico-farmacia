'use client';

import { useState, useTransition } from 'react';
import { FileText, CheckSquare, AlertTriangle, TrendingUp, Euro, Printer, ChevronDown, ChevronUp, Loader2, Plus, X, Pencil } from 'lucide-react';
import { aggiornaEsitoPacaAction, toggleVoceChecklistPacaAction, inizializzaChecklistPacaAction, type EsitoPaca } from '@/app/(app)/report-paca/actions';

interface VoceChecklist { id: string; voce: string; completata: boolean; }

interface PazientePaca {
  id: string;
  nominativo: string;
  sala: string;
  numero_letto: number;
  codice_sdo: string | null;
  data_ricovero: string | null;
  data_dimissione: string | null;
  diagnosi_principale: string | null;
  esito_paca: string | null;
  importo_drg: number | null;
  data_chiusura_cartella: string | null;
  note_paca: string | null;
  checklist: VoceChecklist[];
}

interface Props {
  pazienti: PazientePaca[];
  orgId: string;
  orgName: string;
  uoNome: string | null;
  userName: string;
}

const ESITI_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  in_corso:     { label: 'In corso',     color: 'text-ink-soft',  bg: 'bg-line/30' },
  approvata:    { label: 'Approvata',    color: 'text-forest',    bg: 'bg-forest/10' },
  rifiutata:    { label: 'Rifiutata',    color: 'text-red-600',   bg: 'bg-red-50' },
  in_revisione: { label: 'In revisione', color: 'text-amber',     bg: 'bg-amber/10' },
};

function esitoInfo(esito: string | null) {
  return ESITI_LABEL[esito ?? 'in_corso'] ?? ESITI_LABEL.in_corso;
}

export function ReportPacaView({ pazienti, orgId, orgName, uoNome, userName }: Props) {
  const now = new Date();
  const [annoFiltro, setAnnoFiltro] = useState(String(now.getFullYear()));
  const [meseFiltro, setMeseFiltro] = useState('');

  // Pazienti con data nel periodo (per KPI e statistiche)
  const pazientiFiltrati = pazienti.filter((p) => {
    const data = p.data_chiusura_cartella || p.data_dimissione;
    if (!data) return false; // senza data = ancora ricoverati, escludi dai KPI
    if (annoFiltro && !data.startsWith(annoFiltro)) return false;
    if (meseFiltro && !data.startsWith(`${annoFiltro}-${meseFiltro.padStart(2, '0')}`)) return false;
    return true;
  });

  // Dettaglio cartelle: include sempre i pazienti ancora ricoverati (senza data dimissione)
  const pazientiDettaglio = pazienti.filter((p) => {
    const data = p.data_chiusura_cartella || p.data_dimissione;
    if (!data) return true; // ricoverati attuali: sempre visibili
    if (annoFiltro && !data.startsWith(annoFiltro)) return false;
    if (meseFiltro && !data.startsWith(`${annoFiltro}-${meseFiltro.padStart(2, '0')}`)) return false;
    return true;
  });

  // Statistiche
  const totale = pazientiFiltrati.length;
  const approvate = pazientiFiltrati.filter((p) => p.esito_paca === 'approvata').length;
  const rifiutate = pazientiFiltrati.filter((p) => p.esito_paca === 'rifiutata').length;
  const inRevisione = pazientiFiltrati.filter((p) => p.esito_paca === 'in_revisione').length;
  const importoTotale = pazientiFiltrati
    .filter((p) => p.esito_paca === 'approvata')
    .reduce((s, p) => s + (p.importo_drg ?? 0), 0);

  // Criticità: quali voci checklist più spesso non completate
  const voceCount: Record<string, { totale: number; incomplete: number }> = {};
  for (const p of pazientiFiltrati) {
    for (const v of p.checklist) {
      if (!voceCount[v.voce]) voceCount[v.voce] = { totale: 0, incomplete: 0 };
      voceCount[v.voce].totale++;
      if (!v.completata) voceCount[v.voce].incomplete++;
    }
  }
  const criticita = Object.entries(voceCount)
    .filter(([, c]) => c.incomplete > 0)
    .sort((a, b) => b[1].incomplete - a[1].incomplete)
    .slice(0, 10);

  // Dati mensili (ultimi 12 mesi per grafico)
  const mensili: Record<string, { chiuse: number; approvate: number; importo: number }> = {};
  for (const p of pazienti) {
    const data = p.data_chiusura_cartella || p.data_dimissione;
    if (!data) continue;
    const mese = data.slice(0, 7); // YYYY-MM
    if (!mensili[mese]) mensili[mese] = { chiuse: 0, approvate: 0, importo: 0 };
    mensili[mese].chiuse++;
    if (p.esito_paca === 'approvata') {
      mensili[mese].approvate++;
      mensili[mese].importo += p.importo_drg ?? 0;
    }
  }
  const mesiOrdinati = Object.keys(mensili).sort().slice(-12);
  const maxChiuse = Math.max(...mesiOrdinati.map((m) => mensili[m].chiuse), 1);
  const maxImporto = Math.max(...mesiOrdinati.map((m) => mensili[m].importo), 1);

  function formattaEuro(n: number) {
    return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  function formattaMese(ym: string) {
    const [y, m] = ym.split('-');
    return `${['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][parseInt(m) - 1]} ${y}`;
  }

  function stampaReport() {
    const righe = pazientiFiltrati.map((p) => {
      const esito = esitoInfo(p.esito_paca);
      const completate = p.checklist.filter((v) => v.completata).length;
      const totV = p.checklist.length;
      return `<tr>
        <td>${p.nominativo}</td>
        <td style="font-family:monospace">${p.codice_sdo ?? '—'}</td>
        <td>${p.data_ricovero ? new Date(p.data_ricovero).toLocaleDateString('it-IT') : '—'}</td>
        <td>${p.data_dimissione ? new Date(p.data_dimissione).toLocaleDateString('it-IT') : '—'}</td>
        <td>${p.diagnosi_principale ?? '—'}</td>
        <td><span style="font-weight:600">${esito.label}</span></td>
        <td style="text-align:right">${p.importo_drg ? formattaEuro(p.importo_drg) : '—'}</td>
        <td style="text-align:center">${completate}/${totV}</td>
        <td>${p.note_paca ?? ''}</td>
      </tr>`;
    }).join('');

    const criticitaRighe = criticita.map(([voce, c]) => `<tr>
      <td>${voce}</td>
      <td style="text-align:center">${c.incomplete}</td>
      <td style="text-align:center">${c.totale}</td>
      <td style="text-align:center">${Math.round((c.incomplete / c.totale) * 100)}%</td>
    </tr>`).join('');

    const periodo = meseFiltro
      ? `${['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][parseInt(meseFiltro) - 1]} ${annoFiltro}`
      : annoFiltro ? `Anno ${annoFiltro}` : 'Tutti i periodi';

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<title>Report PACA/DRG — ${orgName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111;padding:24px;font-size:11px}
h1{font-size:16px;font-weight:700;color:#1f3d2b;margin-bottom:4px}
h2{font-size:12px;font-weight:700;color:#1f3d2b;margin:20px 0 8px;border-bottom:1px solid #d1fae5;padding-bottom:4px}
.sub{font-size:10px;color:#6b7280;margin-bottom:16px}
.kpi{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.kpi-box{border:1px solid #d1d5db;border-radius:8px;padding:10px 16px;min-width:110px}
.kpi-box .val{font-size:20px;font-weight:700;color:#1f3d2b}
.kpi-box .lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#f3f4f6;padding:5px 7px;text-align:left;font-size:10px;color:#374151;font-weight:600}
td{padding:4px 7px;border-bottom:1px solid #f0f0f0;vertical-align:top}
.footer{margin-top:24px;font-size:9px;color:#9ca3af;text-align:right}
@media print{@page{size:A4 landscape;margin:1cm}body{padding:0}}
</style></head><body>
<h1>Report PACA / DRG — ${uoNome ?? orgName}</h1>
<div class="sub">Periodo: ${periodo} · Generato il ${new Date().toLocaleDateString('it-IT')} da ${userName}</div>

<div class="kpi">
  <div class="kpi-box"><div class="val">${totale}</div><div class="lbl">Cartelle analizzate</div></div>
  <div class="kpi-box"><div class="val" style="color:#065f46">${approvate}</div><div class="lbl">Approvate PACA</div></div>
  <div class="kpi-box"><div class="val" style="color:#dc2626">${rifiutate}</div><div class="lbl">Rifiutate</div></div>
  <div class="kpi-box"><div class="val" style="color:#d97706">${inRevisione}</div><div class="lbl">In revisione</div></div>
  <div class="kpi-box"><div class="val" style="color:#065f46">${formattaEuro(importoTotale)}</div><div class="lbl">DRG liquidato</div></div>
  ${totale > 0 ? `<div class="kpi-box"><div class="val">${Math.round((approvate/totale)*100)}%</div><div class="lbl">Tasso approvazione</div></div>` : ''}
</div>

<h2>Dettaglio cartelle</h2>
<table>
<thead><tr><th>Paziente</th><th>N° SDO</th><th>Ricovero</th><th>Dimissione</th><th>Diagnosi</th><th>Esito PACA</th><th>DRG €</th><th>Checklist</th><th>Note</th></tr></thead>
<tbody>${righe || '<tr><td colspan="9" style="text-align:center;color:#9ca3af">Nessuna cartella nel periodo selezionato</td></tr>'}</tbody>
</table>

${criticita.length > 0 ? `
<h2>Criticità rilevate (voci checklist più spesso incomplete)</h2>
<table>
<thead><tr><th>Voce checklist</th><th style="text-align:center">Volte incompleta</th><th style="text-align:center">Totale occorrenze</th><th style="text-align:center">% criticità</th></tr></thead>
<tbody>${criticitaRighe}</tbody>
</table>` : ''}

<div class="footer">Carico Farmacia · ${orgName} · ${uoNome ?? ''}</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) w.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url); });
  }

  const anni = [...new Set(pazienti
    .map((p) => (p.data_chiusura_cartella || p.data_dimissione)?.slice(0, 4))
    .filter(Boolean)
  )].sort().reverse() as string[];
  if (!anni.includes(String(now.getFullYear()))) anni.unshift(String(now.getFullYear()));

  return (
    <div className="space-y-6">
      {/* Filtri periodo */}
      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink">Periodo:</span>
        <select
          value={annoFiltro}
          onChange={(e) => setAnnoFiltro(e.target.value)}
          className="input-base text-sm py-1 w-28"
        >
          <option value="">Tutti gli anni</option>
          {anni.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={meseFiltro}
          onChange={(e) => setMeseFiltro(e.target.value)}
          className="input-base text-sm py-1 w-36"
          disabled={!annoFiltro}
        >
          <option value="">Tutti i mesi</option>
          {['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
            .map((m, i) => <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>)}
        </select>
        <button onClick={stampaReport} className="btn-primary text-sm ml-auto flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Stampa / PDF
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={<FileText className="w-5 h-5 text-ink-soft" />} valore={totale} label="Cartelle analizzate" />
        <KpiCard icon={<CheckSquare className="w-5 h-5 text-forest" />} valore={approvate} label="Approvate PACA" color="text-forest" />
        <KpiCard icon={<X className="w-5 h-5 text-red-500" />} valore={rifiutate} label="Rifiutate" color="text-red-600" />
        <KpiCard icon={<AlertTriangle className="w-5 h-5 text-amber" />} valore={inRevisione} label="In revisione" color="text-amber" />
        <KpiCard
          icon={<Euro className="w-5 h-5 text-forest" />}
          valore={formattaEuro(importoTotale)}
          label="DRG liquidato"
          color="text-forest"
        />
      </div>

      {/* Tasso approvazione */}
      {totale > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink">Tasso approvazione PACA</span>
            <span className="text-sm font-bold text-forest">{Math.round((approvate / totale) * 100)}%</span>
          </div>
          <div className="h-3 bg-line rounded-full overflow-hidden flex">
            <div className="bg-forest h-full transition-all" style={{ width: `${Math.round((approvate / totale) * 100)}%` }} />
            <div className="bg-amber h-full transition-all" style={{ width: `${Math.round((inRevisione / totale) * 100)}%` }} />
            <div className="bg-red-400 h-full transition-all" style={{ width: `${Math.round((rifiutate / totale) * 100)}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-[11px] text-ink-mute">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-forest inline-block" /> Approvate</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber inline-block" /> In revisione</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Rifiutate</span>
          </div>
        </div>
      )}

      {/* Grafico mensile */}
      {mesiOrdinati.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-forest" />
            <h2 className="text-sm font-semibold text-ink">Andamento mensile (ultimi 12 mesi)</h2>
          </div>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-max pb-2" style={{ minHeight: 120 }}>
              {mesiOrdinati.map((mese) => {
                const d = mensili[mese];
                const hChiuse = Math.round((d.chiuse / maxChiuse) * 100);
                const hApp = Math.round((d.approvate / maxChiuse) * 100);
                return (
                  <div key={mese} className="flex flex-col items-center gap-1 w-14">
                    <span className="text-[9px] text-forest font-semibold">
                      {d.importo > 0 ? `€${Math.round(d.importo/1000)}k` : ''}
                    </span>
                    <div className="flex items-end gap-0.5 h-24">
                      <div className="w-5 rounded-t bg-line/60 flex items-end justify-center" style={{ height: `${hChiuse}%`, minHeight: 4 }}>
                        <span className="text-[8px] text-ink-mute pb-0.5">{d.chiuse}</span>
                      </div>
                      <div className="w-5 rounded-t bg-forest/70 flex items-end justify-center" style={{ height: `${hApp}%`, minHeight: 4 }}>
                        <span className="text-[8px] text-white pb-0.5">{d.approvate}</span>
                      </div>
                    </div>
                    <span className="text-[9px] text-ink-mute text-center leading-tight">{formattaMese(mese)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-4 mt-1 text-[11px] text-ink-mute">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-line/60 inline-block" /> Totale chiuse</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-forest/70 inline-block" /> Approvate</span>
          </div>
        </div>
      )}

      {/* Criticità */}
      {criticita.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber" />
            <h2 className="text-sm font-semibold text-ink">Criticità più frequenti</h2>
            <span className="text-xs text-ink-mute">(voci checklist incomplete)</span>
          </div>
          <div className="space-y-2">
            {criticita.map(([voce, c]) => {
              const pct = Math.round((c.incomplete / c.totale) * 100);
              return (
                <div key={voce}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-ink truncate flex-1 mr-2">{voce}</span>
                    <span className="text-amber font-semibold shrink-0">{c.incomplete}× ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-line rounded-full overflow-hidden">
                    <div className="h-full bg-amber/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabella dettaglio cartelle */}
      <div className="card">
        <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-ink-soft" />
          Dettaglio cartelle ({pazientiDettaglio.length})
        </h2>
        {pazientiDettaglio.length === 0 ? (
          <p className="text-sm text-ink-mute text-center py-8">Nessuna cartella nel periodo selezionato.</p>
        ) : (
          <div className="space-y-2">
            {pazientiDettaglio.map((p) => (
              <RigaCartella key={p.id} paziente={p} orgId={orgId} userName={userName} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, valore, label, color }: { icon: React.ReactNode; valore: string | number; label: string; color?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-ink-mute">{icon}<span className="text-xs">{label}</span></div>
      <span className={`text-2xl font-bold ${color ?? 'text-ink'}`}>{valore}</span>
    </div>
  );
}

// ── Riga cartella con editor esito PACA ───────────────────────────────────────

function RigaCartella({ paziente: p, orgId, userName }: { paziente: PazientePaca; orgId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [esito, setEsito] = useState<EsitoPaca>((p.esito_paca as EsitoPaca) ?? 'in_corso');
  const [importo, setImporto] = useState(p.importo_drg ? String(p.importo_drg) : '');
  const [dataChiusura, setDataChiusura] = useState(p.data_chiusura_cartella ?? '');
  const [note, setNote] = useState(p.note_paca ?? '');
  const [saved, setSaved] = useState(false);
  const [checklistItems, setChecklistItems] = useState<VoceChecklist[]>(p.checklist);
  const [pendingVoce, setPendingVoce] = useState<string | null>(null);
  const [initPending, setInitPending] = useState(false);

  const completate = checklistItems.filter((v) => v.completata).length;
  const totV = checklistItems.length;
  const info = esitoInfo(esito);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await aggiornaEsitoPacaAction(p.id, esito, importo ? parseFloat(importo) : null, dataChiusura || null, note || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function handleToggleVoce(id: string, attuale: boolean) {
    setPendingVoce(id);
    setChecklistItems(prev => prev.map(v => v.id === id ? { ...v, completata: !attuale } : v));
    await toggleVoceChecklistPacaAction(id, !attuale, userName || 'Utente');
    setPendingVoce(null);
  }

  async function handleInizializza() {
    setInitPending(true);
    await inizializzaChecklistPacaAction(p.id, orgId, p.codice_sdo ?? undefined);
    setInitPending(false);
  }

  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-soft/40"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink truncate">{p.nominativo}</span>
            {p.codice_sdo && <span className="text-[10px] text-ink-mute font-mono shrink-0">SDO {p.codice_sdo}</span>}
          </div>
          {p.diagnosi_principale && <p className="text-xs text-ink-mute truncate">{p.diagnosi_principale}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totV > 0 && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${completate === totV ? 'bg-forest/10 text-forest' : 'bg-amber/10 text-amber'}`}>
              {completate}/{totV}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${info.bg} ${info.color}`}>{info.label}</span>
          {p.importo_drg && <span className="text-xs font-semibold text-forest">{p.importo_drg.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-ink-mute" /> : <ChevronDown className="w-3.5 h-3.5 text-ink-mute" />}
        </div>
      </div>

      {open && (
        <form onSubmit={handleSave} className="border-t border-line bg-bg-soft/40 px-3 py-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-ink-mute block mb-0.5">Esito PACA</label>
              <select
                value={esito}
                onChange={(e) => setEsito(e.target.value as EsitoPaca)}
                className="input-base text-xs py-1 w-full"
              >
                <option value="in_corso">In corso</option>
                <option value="approvata">Approvata</option>
                <option value="rifiutata">Rifiutata</option>
                <option value="in_revisione">In revisione</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-ink-mute block mb-0.5">Importo DRG liquidato (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                placeholder="es. 4500.00"
                className="input-base text-xs py-1 w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink-mute block mb-0.5">Data chiusura cartella</label>
              <input
                type="date"
                value={dataChiusura}
                onChange={(e) => setDataChiusura(e.target.value)}
                className="input-base text-xs py-1 w-full"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[10px] text-ink-mute block mb-0.5">Note PACA</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Osservazioni, suggerimenti…"
                className="input-base text-xs py-1 w-full"
              />
            </div>
          </div>

          {/* Checklist documentazione sanitaria */}
          <div className="border-t border-line/60 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-ink-mute uppercase tracking-wide font-semibold flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                Checklist chiusura cartella
              </p>
              {checklistItems.length === 0 && (
                <button
                  type="button"
                  onClick={handleInizializza}
                  disabled={initPending}
                  className="text-[10px] text-forest font-semibold flex items-center gap-1 hover:underline disabled:opacity-60"
                >
                  {initPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Inizializza
                </button>
              )}
            </div>
            {checklistItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                {checklistItems.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleToggleVoce(v.id, v.completata)}
                    disabled={pendingVoce === v.id}
                    className="flex items-center gap-2 text-xs text-left w-full px-1.5 py-1 rounded hover:bg-bg-soft/60 transition-colors disabled:opacity-60"
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${v.completata ? 'bg-forest border-forest text-white' : 'border-line bg-white'}`}>
                      {pendingVoce === v.id
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin text-ink-mute" />
                        : v.completata
                          ? <span className="text-[9px] font-bold leading-none">✓</span>
                          : null}
                    </span>
                    <span className={v.completata ? 'text-ink-mute line-through' : 'text-ink'}>{v.voce}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-mute">Nessuna voce — clicca &quot;Inizializza&quot; per creare la checklist standard.</p>
            )}
          </div>

          <button type="submit" disabled={pending} className="btn-primary text-xs py-1.5">
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? '✓ Salvato' : 'Salva esito PACA'}
          </button>
        </form>
      )}
    </div>
  );
}
