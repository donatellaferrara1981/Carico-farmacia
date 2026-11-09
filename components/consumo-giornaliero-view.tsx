'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, FileSignature, Package, Users } from 'lucide-react';
import { SharePrintBar, htmlBase } from '@/components/share-print-bar';
import { isAltoCosto } from '@/lib/antibiotici';
import { CLASSI_FORMA, classeForma, isIntegratore, type ClasseForma } from '@/lib/classifica-consumo';

interface ProdottoRiga {
  id: string;
  categoria: string;
  principio_attivo: string;
  nome_commerciale: string | null;
  forma_farmaceutica: string;
  dosaggio: string | null;
  consumo_giornaliero: number;
  nominativa: boolean;
  note: string | null;
}
interface TerapiaRiga {
  paziente_id: string;
  prodotto_id: string | null;
  principio_attivo: string;
  dosaggio: string | null;
  posologia: string | null;
}
interface PazienteRiga { id: string; nominativo: string; numero_letto: number; sala: string }

interface Riga {
  chiave: string;
  principio: string;
  dosaggio: string;
  nomi: string[];
  pazienti: { nome: string; posologia: string | null }[];
  altoCosto: boolean;
  nominativa: boolean;
  consumo: number;
}

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SEZIONE_INTEGRATORI = 'integratori';

export function ConsumoGiornalieroView({ prodotti, terapie, pazienti, orgName, uoNome }: {
  prodotti: ProdottoRiga[];
  terapie: TerapiaRiga[];
  pazienti: PazienteRiga[];
  orgName: string;
  uoNome: string;
}) {
  const sale = useMemo(() => [...new Set(pazienti.map((p) => p.sala).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')), [pazienti]);
  const [escluse, setEscluse] = useState<Set<string>>(new Set());
  const selezionate = sale.filter((x) => !escluse.has(x));
  const tutteSel = escluse.size === 0;
  const toggleSala = (x: string) =>
    setEscluse((prev) => { const n = new Set(prev); if (n.has(x)) n.delete(x); else n.add(x); return n; });

  const dati = useMemo(() => {
    const nomePaz = new Map(pazienti.filter((p) => !escluse.has(p.sala)).map((p) => [p.id, p.nominativo]));
    const farmaci = prodotti.filter((p) => p.categoria === 'terapie');

    // pazienti per prodotto (collegamento diretto, altrimenti per principio attivo + dosaggio)
    const perProdotto = new Map<string, { nome: string; posologia: string | null }[]>();
    for (const p of farmaci) {
      const trovate = terapie.filter((t) =>
        t.prodotto_id
          ? t.prodotto_id === p.id
          : norm(t.principio_attivo) === norm(p.principio_attivo) && norm(t.dosaggio) === norm(p.dosaggio),
      );
      const lista: { nome: string; posologia: string | null }[] = [];
      const visti = new Set<string>();
      for (const t of trovate) {
        const nome = nomePaz.get(t.paziente_id);
        if (!nome || visti.has(t.paziente_id)) continue; // solo pazienti dell'UO attiva
        visti.add(t.paziente_id);
        lista.push({ nome, posologia: t.posologia });
      }
      if (lista.length) perProdotto.set(p.id, lista);
    }

    const sezioni = new Map<string, Map<string, Riga>>();
    for (const p of farmaci) {
      const pz = perProdotto.get(p.id);
      if (!pz) continue;
      const sezione = isIntegratore(p) ? SEZIONE_INTEGRATORI : classeForma(p);
      const chiave = `${norm(p.principio_attivo)}|${norm(p.dosaggio)}`;
      const mappa = sezioni.get(sezione) ?? new Map<string, Riga>();
      const r = mappa.get(chiave) ?? {
        chiave, principio: p.principio_attivo.trim(), dosaggio: (p.dosaggio ?? '').trim(),
        nomi: [], pazienti: [], altoCosto: isAltoCosto(p.principio_attivo), nominativa: false, consumo: 0,
      };
      r.consumo += Number(p.consumo_giornaliero) || 0;
      if (p.nome_commerciale && !r.nomi.some((n) => norm(n) === norm(p.nome_commerciale))) r.nomi.push(p.nome_commerciale.trim());
      for (const x of pz) if (!r.pazienti.some((y) => y.nome === x.nome)) r.pazienti.push(x);
      r.nominativa = r.nominativa || p.nominativa;
      mappa.set(chiave, r);
      sezioni.set(sezione, mappa);
    }

    const ordina = (m: Map<string, Riga>) =>
      [...m.values()]
        .map((r) => ({ ...r, nomi: r.nomi.sort((a, b) => a.localeCompare(b, 'it')), pazienti: r.pazienti.sort((a, b) => a.nome.localeCompare(b.nome, 'it')) }))
        .sort((a, b) => a.principio.localeCompare(b.principio, 'it') || a.dosaggio.localeCompare(b.dosaggio, 'it'));

    const gruppi = CLASSI_FORMA
      .map((c) => ({ id: c.id as ClasseForma | typeof SEZIONE_INTEGRATORI, label: c.label, righe: ordina(sezioni.get(c.id) ?? new Map()) }))
      .filter((g) => g.righe.length > 0);
    const integratori = ordina(sezioni.get(SEZIONE_INTEGRATORI) ?? new Map());

    const tutte = [...gruppi.flatMap((g) => g.righe)];
    const nutrizioni = prodotti
      .filter((p) => p.categoria === 'nutrizioni' && p.consumo_giornaliero > 0)
      .sort((a, b) => a.principio_attivo.localeCompare(b.principio_attivo, 'it'));

    return {
      gruppi, integratori, nutrizioni,
      motivate: tutte.filter((r) => r.altoCosto),
      cartacee: tutte.filter((r) => r.nominativa),
      totale: tutte.length,
    };
  }, [prodotti, terapie, pazienti, escluse]);

  const vuoto = dati.gruppi.length === 0 && dati.integratori.length === 0;
  const oggi = new Date().toLocaleDateString('it-IT');

  function testoCondivisione() {
    const L: string[] = [`💊 Consumo giornaliero — ${uoNome || orgName}`, `Data: ${oggi}${tutteSel ? '' : ' · Sale: ' + selezionate.join(', ')}`, ''];
    for (const g of dati.gruppi) {
      L.push(`— ${g.label.toUpperCase()}`);
      for (const r of g.righe) {
        L.push(`• ${r.principio}${r.dosaggio ? ' ' + r.dosaggio : ''}${r.nomi.length ? ` (${r.nomi.join(', ')})` : ''}${r.altoCosto ? ' ⚠ RICHIESTA MOTIVATA' : ''}${r.nominativa ? ' 📝 NOMINATIVA' : ''}`);
        L.push(`   ${r.pazienti.map((p) => p.nome).join('; ')}`);
      }
      L.push('');
    }
    if (dati.integratori.length) {
      L.push('— INTEGRATORI (non forniti dalla farmacia)');
      for (const r of dati.integratori) L.push(`• ${r.principio}${r.dosaggio ? ' ' + r.dosaggio : ''}: ${r.pazienti.map((p) => p.nome).join('; ')}`);
    }
    return L.join('\n');
  }

  function generaHtml() {
    const fmt = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
    const badge = (r: Riga) =>
      `${r.altoCosto ? '<b class="red">⚠ Motivata</b> ' : ''}${r.nominativa ? '<b class="red">📝 Cartacea DS</b>' : ''}`;
    const sez = (label: string, righe: Riga[]) =>
      `<tr class="sez"><td colspan="6">${esc(label)}</td></tr>` +
      righe
        .map((r) => `<tr><td><b>${esc(r.principio)}</b> ${esc(r.dosaggio)}</td><td>${esc(r.nomi.join(', '))}</td><td class="num">${r.consumo ? fmt(r.consumo) : '—'}</td><td class="num">${r.consumo ? fmt(r.consumo * 7) : '—'}</td><td>${esc(r.pazienti.map((p) => p.nome).join('; '))}</td><td>${badge(r)}</td></tr>`)
        .join('');
    let corpo = `<table class="fit"><thead><tr><th>Principio attivo / dosaggio</th><th>Nome commerciale</th><th class="num">Die</th><th class="num">x7 gg</th><th>Pazienti</th><th>Richieste</th></tr></thead><tbody>`;
    for (const g of dati.gruppi) corpo += sez(g.label, g.righe);
    if (dati.integratori.length) corpo += sez('Integratori — non forniti dalla farmacia', dati.integratori);
    corpo += '</tbody></table>';
    const extra = `<style>
  table.fit{margin-top:4px}
  table.fit th,table.fit td{font-size:8px;padding:1.5px 4px;line-height:1.25}
  tr.sez td{background:#e5e7eb !important;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.03em}
  @media print{@page{size:A4 portrait;margin:0.8cm}tr{break-inside:avoid}}
</style>
<script>
  // adatta il contenuto a un unico foglio A4
  (function(){var H=(29.7-1.6)/2.54*96,W=(21-1.6)/2.54*96;
    var h=document.body.scrollHeight,w=document.body.scrollWidth;
    var k=Math.min(1,H/h,W/w); if(k<1) document.body.style.zoom=k;})();
</script>`;
    return htmlBase(`Consumo giornaliero — ${esc(uoNome || orgName)}`, `Data: ${oggi}${tutteSel ? '' : ' · Sale: ' + esc(selezionate.join(', '))} · fabbisogno settimanale = consumo die × 7`, corpo).replace('</body>', `${extra}</body>`);
  }

  const filtroSale = sale.length > 1 && (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-soft mr-1">Sale:</span>
      {sale.map((x) => {
        const on = !escluse.has(x);
        return (
          <button key={x} type="button" onClick={() => toggleSala(x)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? 'bg-forest text-white border-forest' : 'bg-bg-soft text-ink-mute border-line hover:border-forest/40'}`}>
            {x}
          </button>
        );
      })}
      <button type="button" onClick={() => setEscluse(tutteSel ? new Set(sale) : new Set())} className="text-xs underline text-ink-soft ml-1">
        {tutteSel ? 'Deseleziona tutte' : 'Seleziona tutte'}
      </button>
    </div>
  );

  if (vuoto) {
    return (
      <div className="space-y-4">
      {filtroSale}
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-mute">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Nessuna terapia abbinata ai pazienti di questa unità operativa.</p>
        <p className="text-xs mt-1">Carica il file e premi «Estrai»: il calcolo comparirà qui.</p>
      </div>
      </div>
    );
  }

  const Badge = ({ r }: { r: Riga }) => (
    <>
      {r.altoCosto && (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/30 font-medium">
          <AlertTriangle className="w-3 h-3" /> Richiesta motivata
        </span>
      )}
      {r.nominativa && (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-abx-soft text-abx border border-abx/30 font-medium">
          <FileSignature className="w-3 h-3" /> Richiesta cartacea · Direzione Sanitaria
        </span>
      )}
    </>
  );

  const Riga = ({ r }: { r: Riga }) => (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-semibold text-ink ${r.altoCosto ? 'underline decoration-amber decoration-2 underline-offset-2' : ''}`}>
          {r.principio}
        </span>
        {r.dosaggio && <span className="text-sm text-ink-soft">{r.dosaggio}</span>}
        <Badge r={r} />
      </div>
      {r.nomi.length > 0 && <p className="text-xs text-ink-mute mt-0.5">Nomi commerciali: {r.nomi.join(', ')}</p>}
      <p className="flex items-start gap-1.5 text-sm text-ink mt-1">
        <Users className="w-3.5 h-3.5 text-forest mt-1 shrink-0" />
        <span>{r.pazienti.map((p) => p.nome + (p.posologia ? ` (${p.posologia})` : '')).join(' · ')}</span>
      </p>
    </li>
  );

  return (
    <div className="space-y-5">
      {filtroSale}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">{dati.totale} farmaci · {uoNome}</p>
        <SharePrintBar titolo={`Consumo giornaliero — ${uoNome || orgName}`} testoCondivisione={testoCondivisione} generaHtml={generaHtml} />
      </div>

      {(dati.motivate.length > 0 || dati.cartacee.length > 0) && (
        <section className="rounded-xl border border-amber/40 bg-amber/5 p-4 space-y-2">
          <h2 className="font-semibold text-ink text-sm">Da richiedere</h2>
          {dati.motivate.length > 0 && (
            <p className="text-sm text-ink">
              <span className="font-medium text-amber">⚠ Richiesta specifica motivata ({dati.motivate.length}):</span>{' '}
              {dati.motivate.map((r) => `${r.principio}${r.dosaggio ? ' ' + r.dosaggio : ''}`).join(', ')}
            </p>
          )}
          {dati.cartacee.length > 0 && (
            <p className="text-sm text-ink">
              <span className="font-medium text-abx">📝 Richiesta cartacea alla Direzione Sanitaria ({dati.cartacee.length}):</span>{' '}
              {dati.cartacee.map((r) => `${r.principio}${r.dosaggio ? ' ' + r.dosaggio : ''}`).join(', ')}
            </p>
          )}
        </section>
      )}

      {dati.gruppi.map((g) => (
        <section key={g.id}>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">
            {g.label} <span className="font-normal opacity-70">· {g.righe.length}</span>
          </h2>
          <ul className="rounded-xl border border-line bg-bg-card divide-y divide-line">
            {g.righe.map((r) => <Riga key={r.chiave} r={r} />)}
          </ul>
        </section>
      ))}

      {dati.integratori.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1">
            Integratori <span className="font-normal opacity-70">· {dati.integratori.length}</span>
          </h2>
          <p className="text-xs text-ink-mute mb-2">Non forniti dalla farmacia: raggruppati qui, fuori dal calcolo.</p>
          <ul className="rounded-xl border border-dashed border-line bg-bg-card divide-y divide-line">
            {dati.integratori.map((r) => <Riga key={r.chiave} r={r} />)}
          </ul>
        </section>
      )}

      {dati.nutrizioni.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">
            Nutrizioni <span className="font-normal opacity-70">· {dati.nutrizioni.length}</span>
          </h2>
          <ul className="rounded-xl border border-line bg-bg-card divide-y divide-line">
            {dati.nutrizioni.map((p) => (
              <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-ink font-medium">
                  {p.principio_attivo}{p.nome_commerciale ? <span className="text-ink-mute font-normal"> · {p.nome_commerciale}</span> : null}
                </span>
                <span className="text-ink-soft tabular-nums">{p.consumo_giornaliero}/die</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
