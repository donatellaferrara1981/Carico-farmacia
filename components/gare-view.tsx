'use client';

import { useState, useTransition, useMemo } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, AlertTriangle, Search, FileText, CheckCircle2, XCircle, ShieldCheck, RefreshCw, Tag } from 'lucide-react';
import { aggiungiGaraAction, modificaGaraAction, eliminaGaraAction, sincronizzaNominativeAction } from '@/app/(app)/gare/actions';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';
import { GareCercaOnline } from '@/components/gare-cerca-online';

export interface Gara {
  id: string;
  numero_gara: string;
  descrizione: string;
  categoria: 'farmaci' | 'sanitario' | 'entrambi';
  ditta_aggiudicataria: string;
  prezzo_unitario: number | null;
  unita_misura: string | null;
  data_inizio: string | null;
  data_scadenza: string | null;
  lotto: string | null;
  aic: string | null;
  note: string | null;
}

export interface ProdottoBase {
  id: string;
  principio_attivo: string;
  forma_farmaceutica: string;
  dosaggio: string | null;
  categoria: string;
  quantita: number;
  nominativa: boolean;
  nominativa_manuale: boolean;
}

const CAT_LABEL: Record<string, string> = {
  farmaci: 'Farmaci',
  sanitario: 'Sanitario',
  entrambi: 'Farmaci + Sanitario',
};
const CAT_COLOR: Record<string, string> = {
  farmaci: 'bg-forest/10 text-forest border-forest/20',
  sanitario: 'bg-amber/10 text-amber-700 border-amber/20',
  entrambi: 'bg-purple-50 text-purple-700 border-purple-200',
};

// Normalizza stringa per matching (minuscolo, rimuove punteggiatura extra)
function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9àèìòù\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Verifica se un prodotto è coperto da almeno una gara attiva (non scaduta)
function isCoperto(prodotto: ProdottoBase, gare: Gara[]): Gara | null {
  const pa = norm(prodotto.principio_attivo);
  const oggi = Date.now();
  return gare.find(g => {
    const nonScaduta = !g.data_scadenza || new Date(g.data_scadenza).getTime() > oggi;
    if (!nonScaduta) return false;
    const descGara = norm(g.descrizione);
    // Match se il principio attivo è contenuto nella descrizione gara o viceversa
    return descGara.includes(pa) || pa.split(' ').filter(w => w.length > 4).some(w => descGara.includes(w));
  }) ?? null;
}

function giorniAllaScadenza(dataScadenza: string | null): number | null {
  if (!dataScadenza) return null;
  return Math.ceil((new Date(dataScadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ScadenzaBadge({ data }: { data: string | null }) {
  if (!data) return <span className="text-ink-mute text-xs">—</span>;
  const giorni = giorniAllaScadenza(data);
  const label = new Date(data).toLocaleDateString('it-IT');
  if (giorni === null) return <span className="text-xs">{label}</span>;
  if (giorni < 0) return <span className="text-xs font-bold text-abx">SCADUTA ({label})</span>;
  if (giorni <= 30) return <span className="text-xs font-bold text-amber">{label} <span className="text-[10px]">({giorni}gg)</span></span>;
  return <span className="text-xs text-ink">{label}</span>;
}

type Tab = 'gare' | 'copertura';

export function GareView({ gare, prodotti, orgName, orgId }: { gare: Gara[]; prodotti: ProdottoBase[]; orgName: string; orgId: string }) {
  const [tab, setTab] = useState<Tab>('gare');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  const [filtroCat, setFiltroCat] = useState<'tutti' | 'farmaci' | 'sanitario' | 'entrambi'>('tutti');

  const scadute = gare.filter(g => (giorniAllaScadenza(g.data_scadenza) ?? 1) < 0).length;
  const inScadenza = gare.filter(g => { const d = giorniAllaScadenza(g.data_scadenza); return d !== null && d >= 0 && d <= 30; }).length;

  // Analisi copertura
  const copertura = useMemo(() => prodotti.map(p => ({
    prodotto: p,
    gara: isCoperto(p, gare),
  })), [prodotti, gare]);

  const coperti = copertura.filter(c => c.gara !== null);
  const nonCoperti = copertura.filter(c => c.gara === null);

  const filtrare = useMemo(() => {
    return gare.filter(g => {
      const matchCat = filtroCat === 'tutti' || g.categoria === filtroCat;
      const q = cerca.toLowerCase();
      const matchQ = !q || g.descrizione.toLowerCase().includes(q) || g.numero_gara.toLowerCase().includes(q) || g.ditta_aggiudicataria.toLowerCase().includes(q) || (g.aic ?? '').toLowerCase().includes(q) || (g.lotto ?? '').toLowerCase().includes(q);
      return matchCat && matchQ;
    }).sort((a, b) => {
      const da = giorniAllaScadenza(a.data_scadenza) ?? 9999;
      const db = giorniAllaScadenza(b.data_scadenza) ?? 9999;
      return da - db;
    });
  }, [gare, cerca, filtroCat]);

  function testoCondivisione() {
    if (tab === 'copertura') {
      const lines = [`📋 Copertura gare — ${orgName}`, `Data: ${new Date().toLocaleDateString('it-IT')}`, ''];
      lines.push(`✅ COPERTI DA GARA (${coperti.length})`);
      coperti.forEach(c => lines.push(`  • ${c.prodotto.principio_attivo}${c.prodotto.dosaggio ? ' ' + c.prodotto.dosaggio : ''} → ${c.gara!.numero_gara}`));
      lines.push('');
      lines.push(`⚠️ NON IN GARA (${nonCoperti.length})`);
      nonCoperti.forEach(c => lines.push(`  • ${c.prodotto.principio_attivo}${c.prodotto.dosaggio ? ' ' + c.prodotto.dosaggio : ''}`));
      return lines.join('\n');
    }
    const lines = [`📋 Gare d'appalto — ${orgName}`, `Data: ${new Date().toLocaleDateString('it-IT')}`, ''];
    for (const g of filtrare) {
      lines.push(`• [${g.numero_gara}] ${g.descrizione}`);
      lines.push(`  Ditta: ${g.ditta_aggiudicataria}${g.prezzo_unitario ? ` · € ${g.prezzo_unitario.toFixed(4)}/${g.unita_misura ?? 'pz'}` : ''}`);
      if (g.data_scadenza) lines.push(`  Scadenza: ${new Date(g.data_scadenza).toLocaleDateString('it-IT')}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  function generaHtml() {
    if (tab === 'copertura') {
      const righeOk = coperti.map(c => `<tr><td><strong>${c.prodotto.principio_attivo}</strong>${c.prodotto.dosaggio ? ` <span style="color:#6b7280">${c.prodotto.dosaggio}</span>` : ''}</td><td>${c.gara!.numero_gara}</td><td>${c.gara!.ditta_aggiudicataria}</td><td>${c.gara!.data_scadenza ? new Date(c.gara!.data_scadenza).toLocaleDateString('it-IT') : '—'}</td></tr>`).join('');
      const righeNo = nonCoperti.map(c => `<tr style="background:#fef2f2"><td class="red"><strong>${c.prodotto.principio_attivo}</strong>${c.prodotto.dosaggio ? ` ${c.prodotto.dosaggio}` : ''}</td><td colspan="3" class="red">⚠ Non in gara</td></tr>`).join('');
      const corpo = `
        <h2>✅ Prodotti coperti da gara (${coperti.length})</h2>
        <table><thead><tr><th>Prodotto</th><th>N° Gara</th><th>Ditta</th><th>Scadenza</th></tr></thead><tbody>${righeOk}</tbody></table>
        <h2 style="margin-top:16px;color:#dc2626">⚠ Prodotti NON in gara (${nonCoperti.length})</h2>
        <table><thead><tr><th>Prodotto</th><th colspan="3">Stato</th></tr></thead><tbody>${righeNo}</tbody></table>`;
      return htmlBase(`Copertura gare — ${orgName}`, `Data: ${new Date().toLocaleDateString('it-IT')} · ${prodotti.length} prodotti analizzati`, corpo);
    }
    const righe = filtrare.map(g => {
      const giorni = giorniAllaScadenza(g.data_scadenza);
      const scadClass = giorni !== null && giorni < 0 ? 'red' : '';
      return `<tr><td>${g.numero_gara}</td><td><strong>${g.descrizione}</strong>${g.aic ? `<br><span style="color:#6b7280;font-size:9px">AIC: ${g.aic}</span>` : ''}</td><td>${CAT_LABEL[g.categoria]}</td><td>${g.ditta_aggiudicataria}${g.lotto ? `<br><span style="color:#6b7280;font-size:9px">Lotto: ${g.lotto}</span>` : ''}</td><td class="num">${g.prezzo_unitario != null ? `€ ${g.prezzo_unitario.toFixed(4)}` : '—'}${g.unita_misura ? `/${g.unita_misura}` : ''}</td><td class="${scadClass}">${g.data_scadenza ? new Date(g.data_scadenza).toLocaleDateString('it-IT') : '—'}</td></tr>`;
    }).join('');
    const corpo = `<table><thead><tr><th>N° Gara</th><th>Descrizione</th><th>Cat.</th><th>Ditta</th><th class="num">Prezzo</th><th>Scadenza</th></tr></thead><tbody>${righe}</tbody></table>`;
    return htmlBase(`Gare d'appalto — ${orgName}`, `Regione Sicilia · ${new Date().toLocaleDateString('it-IT')} · ${filtrare.length} gare`, corpo);
  }

  const editGara = gare.find(g => g.id === editId) ?? null;

  return (
    <div className="space-y-6">
      {/* Alert scadenze */}
      {(scadute > 0 || inScadenza > 0) && (
        <div className="flex flex-wrap gap-3">
          {scadute > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-abx/10 border border-abx/30 text-sm text-abx">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <strong>{scadute}</strong> gara{scadute > 1 ? 'e' : ''} scadut{scadute > 1 ? 'e' : 'a'}
            </div>
          )}
          {inScadenza > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber/10 border border-amber/30 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <strong>{inScadenza}</strong> gara{inScadenza > 1 ? 'e' : ''} in scadenza (≤30 giorni)
            </div>
          )}
          {nonCoperti.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-700">
              <XCircle className="w-4 h-4 shrink-0" />
              <strong>{nonCoperti.length}</strong> prodott{nonCoperti.length > 1 ? 'i' : 'o'} non in gara
            </div>
          )}
        </div>
      )}

      {/* Tab */}
      <div className="flex items-center gap-2 border-b border-line pb-0">
        {([
          { id: 'gare' as Tab, label: `Elenco gare (${gare.length})` },
          { id: 'copertura' as Tab, label: `Copertura prodotti`, badge: nonCoperti.length > 0 ? nonCoperti.length : null },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.id ? 'border-forest text-forest' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {t.label}
            {t.badge && (
              <span className="w-5 h-5 rounded-full bg-abx text-white text-[10px] font-bold flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'gare' && (
        <>
          {/* Barra azioni */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              {(['tutti', 'farmaci', 'sanitario', 'entrambi'] as const).map(c => (
                <button key={c} onClick={() => setFiltroCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filtroCat === c ? 'bg-forest text-white border-forest' : 'border-line text-ink-soft hover:border-forest/40'}`}>
                  {c === 'tutti' ? 'Tutte' : CAT_LABEL[c]}
                </button>
              ))}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute" />
                <input type="text" placeholder="Cerca farmaco, ditta, AIC…" value={cerca} onChange={e => setCerca(e.target.value)}
                  className="input-base pl-7 pr-3 py-1.5 text-xs w-48" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GareCercaOnline orgId={orgId} />
              <SharePrintBar titolo={`Gare d'appalto — ${orgName}`} testoCondivisione={testoCondivisione} generaHtml={generaHtml} />
              <button onClick={() => { setEditId(null); setShowForm(true); }} title="Nuova gara" className="btn-primary text-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(showForm || editId) && (
            <GaraForm gara={editGara} onClose={() => { setShowForm(false); setEditId(null); }} />
          )}

          {filtrare.length === 0 ? (
            <div className="text-center py-16 text-ink-mute">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{gare.length === 0 ? 'Nessuna gara inserita.' : 'Nessun risultato per i filtri selezionati.'}</p>
              {gare.length === 0 && <p className="text-xs mt-1">Clicca "Nuova gara" per aggiungere la prima.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-soft border-b border-line text-left">
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft">N° Gara</th>
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Descrizione / AIC</th>
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Cat.</th>
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Ditta / Lotto</th>
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft text-right">Prezzo</th>
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft">Scadenza</th>
                    <th className="px-3 py-3 text-xs font-semibold text-ink-soft"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtrare.map(g => (
                    <GaraRow key={g.id} gara={g} onEdit={() => { setEditId(g.id); setShowForm(false); }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'copertura' && (
        <CoperturaView
          coperti={coperti}
          nonCoperti={nonCoperti}
          orgName={orgName}
          onCondividi={testoCondivisione}
          onStampa={generaHtml}
        />
      )}
    </div>
  );
}

// ── Tab Copertura ─────────────────────────────────────────────────────────────

function CoperturaView({
  coperti, nonCoperti, orgName, onCondividi, onStampa,
}: {
  coperti: { prodotto: ProdottoBase; gara: Gara | null }[];
  nonCoperti: { prodotto: ProdottoBase; gara: Gara | null }[];
  orgName: string;
  onCondividi: () => string;
  onStampa: () => string;
}) {
  const [syncPending, startSync] = useTransition();
  const [syncResult, setSyncResult] = useState<{ aggiornati: number; nonInGara: number; totale: number } | null>(null);

  function handleSync() {
    setSyncResult(null);
    startSync(async () => {
      const res = await sincronizzaNominativeAction();
      if ('ok' in res && res.ok) setSyncResult({ aggiornati: res.aggiornati, nonInGara: res.nonInGara, totale: res.totale });
    });
  }

  const totale = coperti.length + nonCoperti.length;
  const perc = totale > 0 ? Math.round((coperti.length / totale) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Riepilogo */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-forest/10 border border-forest/20">
            <CheckCircle2 className="w-4 h-4 text-forest" />
            <span className="text-sm font-semibold text-forest">{coperti.length} in gara</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-abx/10 border border-abx/20">
            <XCircle className="w-4 h-4 text-abx" />
            <span className="text-sm font-semibold text-abx">{nonCoperti.length} non in gara</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-soft border border-line">
            <ShieldCheck className="w-4 h-4 text-ink-soft" />
            <span className="text-sm font-semibold text-ink">{perc}% copertura</span>
          </div>
        </div>
        <SharePrintBar titolo={`Copertura gare — ${orgName}`} testoCondivisione={onCondividi} generaHtml={onStampa} />
      </div>

      {/* Barra copertura */}
      <div className="h-3 rounded-full bg-line overflow-hidden">
        <div className="h-full bg-forest transition-all" style={{ width: `${perc}%` }} />
      </div>

      {/* Sincronizza nominative */}
      <div className="rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-start gap-2.5">
          <Tag className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Aggiorna flag nominativa automaticamente</p>
            <p className="text-xs text-amber-600 mt-0.5">
              I prodotti <strong>non coperti da gara</strong> verranno marcati come <em>nominativa</em>. Quelli in gara verranno deselezionati.
              Le modifiche manuali che hai già fatto rimangono bloccate e non vengono sovrascritte.
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncPending || totale === 0}
          title="Sincronizza nominative"
          className="btn-secondary text-sm shrink-0 flex items-center gap-2"
        >
          {syncPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {/* Feedback sincronizzazione */}
      {syncResult && (
        <div className="rounded-lg border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
          <p className="font-semibold">Sincronizzazione completata</p>
          <p className="text-xs mt-1 text-forest/80">
            {syncResult.aggiornati} prodott{syncResult.aggiornati === 1 ? 'o aggiornato' : 'i aggiornati'} su {syncResult.totale} ·{' '}
            <strong>{syncResult.nonInGara} nominativi</strong> (non in gara) ·{' '}
            {syncResult.totale - syncResult.nonInGara} in gara
          </p>
        </div>
      )}

      {/* Prodotti NON in gara */}
      {nonCoperti.length > 0 && (
        <div className="rounded-xl border border-abx/30 overflow-hidden">
          <div className="px-4 py-2.5 bg-abx/10 border-b border-abx/20 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-abx" />
            <p className="text-sm font-bold text-abx">Prodotti NON coperti da gara ({nonCoperti.length})</p>
          </div>
          <div className="divide-y divide-line/50">
            {nonCoperti.map(({ prodotto: p }) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-soft/40">
                <XCircle className="w-3.5 h-3.5 text-abx shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-ink">{p.principio_attivo}{p.dosaggio ? ` ${p.dosaggio}` : ''}</p>
                    {p.nominativa && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${p.nominativa_manuale ? 'bg-amber/20 text-amber-700 border-amber/40' : 'bg-amber/10 text-amber-600 border-amber/30'}`}>
                        {p.nominativa_manuale ? '★ nominativa' : '⚡ nominativa (auto)'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-mute capitalize">{p.categoria} · {p.forma_farmaceutica}</p>
                </div>
                <span className="text-[10px] text-ink-mute shrink-0">scorta: {p.quantita}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prodotti coperti */}
      {coperti.length > 0 && (
        <div className="rounded-xl border border-forest/20 overflow-hidden">
          <div className="px-4 py-2.5 bg-forest/5 border-b border-forest/10 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-forest" />
            <p className="text-sm font-bold text-forest">Prodotti coperti da gara ({coperti.length})</p>
          </div>
          <div className="divide-y divide-line/50">
            {coperti.map(({ prodotto: p, gara: g }) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-soft/40">
                <CheckCircle2 className="w-3.5 h-3.5 text-forest shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink">{p.principio_attivo}{p.dosaggio ? ` ${p.dosaggio}` : ''}</p>
                  <p className="text-[10px] text-ink-mute capitalize">{p.categoria} · {p.forma_farmaceutica}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-forest">{g!.numero_gara}</p>
                  <p className="text-[10px] text-ink-mute">{g!.ditta_aggiudicataria}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totale === 0 && (
        <div className="text-center py-12 text-ink-mute">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nessun prodotto caricato. Aggiungi prodotti nelle sezioni Terapie, Nutrizioni o Sanitario.</p>
        </div>
      )}
    </div>
  );
}

// ── Riga tabella ──────────────────────────────────────────────────────────────

function GaraRow({ gara: g, onEdit }: { gara: Gara; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Eliminare la gara "${g.numero_gara} — ${g.descrizione}"?`)) return;
    startTransition(async () => { await eliminaGaraAction(g.id); });
  }

  return (
    <tr className="hover:bg-bg-soft/40 group">
      <td className="px-3 py-2.5 text-xs font-mono text-ink-soft whitespace-nowrap">{g.numero_gara}</td>
      <td className="px-3 py-2.5">
        <p className="text-xs font-semibold text-ink">{g.descrizione}</p>
        {g.aic && <p className="text-[10px] text-ink-mute">AIC: {g.aic}</p>}
        {g.note && <p className="text-[10px] text-ink-mute italic mt-0.5">{g.note}</p>}
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CAT_COLOR[g.categoria]}`}>
          {CAT_LABEL[g.categoria]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-xs text-ink">{g.ditta_aggiudicataria}</p>
        {g.lotto && <p className="text-[10px] text-ink-mute">Lotto: {g.lotto}</p>}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
        {g.prezzo_unitario != null ? (
          <>
            <span className="text-xs font-semibold text-ink">€ {g.prezzo_unitario.toFixed(4)}</span>
            {g.unita_misura && <span className="text-[10px] text-ink-mute">/{g.unita_misura}</span>}
          </>
        ) : <span className="text-xs text-ink-mute">—</span>}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <ScadenzaBadge data={g.data_scadenza} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Modifica" className="p-1.5 rounded-md text-ink-mute hover:text-forest hover:bg-forest/10 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={handleDelete} disabled={pending} title="Elimina" className="p-1.5 rounded-md text-ink-mute hover:text-abx hover:bg-abx/10 transition-colors">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

function GaraForm({ gara, onClose }: { gara: Gara | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = gara ? await modificaGaraAction(gara.id, fd) : await aggiungiGaraAction(fd);
      if ('error' in res && res.error) { setError(res.error); return; }
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink text-sm">{gara ? 'Modifica gara' : 'Nuova gara d\'appalto'}</p>
        <button type="button" onClick={onClose}><X className="w-4 h-4 text-ink-mute" /></button>
      </div>
      {error && <p className="text-xs text-abx bg-abx/10 px-3 py-2 rounded-lg">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">N° Gara *</label>
          <input name="numero_gara" defaultValue={gara?.numero_gara} required className="input-base w-full text-sm" placeholder="es. 2024/001" />
        </div>
        <div>
          <label className="label-xs">Categoria *</label>
          <select name="categoria" defaultValue={gara?.categoria ?? 'farmaci'} className="input-base w-full text-sm">
            <option value="farmaci">Farmaci</option>
            <option value="sanitario">Sanitario</option>
            <option value="entrambi">Farmaci + Sanitario</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label-xs">Descrizione farmaco/prodotto *</label>
        <input name="descrizione" defaultValue={gara?.descrizione} required className="input-base w-full text-sm" placeholder="es. Amoxicillina + Ac. Clavulanico 875mg cpr" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">AIC</label>
          <input name="aic" defaultValue={gara?.aic ?? ''} className="input-base w-full text-sm" placeholder="Codice AIC" />
        </div>
        <div>
          <label className="label-xs">Lotto</label>
          <input name="lotto" defaultValue={gara?.lotto ?? ''} className="input-base w-full text-sm" placeholder="N° lotto gara" />
        </div>
      </div>
      <div>
        <label className="label-xs">Ditta aggiudicataria *</label>
        <input name="ditta_aggiudicataria" defaultValue={gara?.ditta_aggiudicataria} required className="input-base w-full text-sm" placeholder="Ragione sociale" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">Prezzo unitario (€)</label>
          <input name="prezzo_unitario" defaultValue={gara?.prezzo_unitario ?? ''} type="number" step="0.0001" min="0" className="input-base w-full text-sm" placeholder="0,0000" />
        </div>
        <div>
          <label className="label-xs">Unità di misura</label>
          <input name="unita_misura" defaultValue={gara?.unita_misura ?? ''} className="input-base w-full text-sm" placeholder="cpr, fl, pz, conf…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-xs">Data inizio</label>
          <input name="data_inizio" defaultValue={gara?.data_inizio ?? ''} type="date" className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="label-xs">Data scadenza</label>
          <input name="data_scadenza" defaultValue={gara?.data_scadenza ?? ''} type="date" className="input-base w-full text-sm" />
        </div>
      </div>
      <div>
        <label className="label-xs">Note</label>
        <textarea name="note" defaultValue={gara?.note ?? ''} rows={2} className="input-base w-full text-sm resize-none" placeholder="Eventuali note…" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost text-sm">Annulla</button>
        <button type="submit" disabled={pending} className="btn-primary text-sm">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {gara ? 'Salva modifiche' : 'Aggiungi gara'}
        </button>
      </div>
    </form>
  );
}
