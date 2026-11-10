// Lettura "a regole" (senza intelligenza artificiale) del PDF terapie del sistema GSO.
// Usa la POSIZIONE delle scritte nella pagina: colonne Farmaco / Principio attivo / Dose / Orario,
// nome del paziente, codice ricovero e posto letto a sinistra. Nessun costo, nessuna rete.

export interface GsoItem { page: number; x: number; y: number; s: string }

export interface GsoFarmaco {
  principio_attivo: string;
  nome_commerciale: string | null;
  forma_farmaceutica: string;
  dosaggio: string | null;
  consumo_giornaliero: number;
  posologia: string | null;
  note: string | null;
}

export interface GsoPaziente {
  nominativo: string;
  numero_letto: number | null;
  sala: string | null;
  codice_sdo: string | null;
  data_nascita: string | null; // YYYY-MM-DD
  farmaci: GsoFarmaco[];
}

export interface GsoRisultato { pazienti: GsoPaziente[]; avvisi: string[]; righe: number }

interface Riga { y: number; page: number; it: { x: number; s: string }[] }
interface Prescr {
  farmaco: string; principio: string; dose: string | null; ora: string | null;
  prn: boolean; indicazione: string[]; via: string | null;
}
interface Rec { nominativo: string; dob: string | null; sdo: string | null; sala: string | null; letto: number | null; rows: Prescr[] }

const VIE = /^(orale|sottocute|oftalmica|endovena|endovenosa|intramuscolo|intramuscolare|cutanea|topica|rettale|inalatoria|sublinguale|auricolare|nasale|transdermica|vaginale)$/i;
const RE_DOB = /^\(\s*(\d{2})\/(\d{2})\/(\d{4})\s*\)$/;
const RE_ORA = /^(?:Dal\s+)?(\d{2})\/\d{2}\/\d{4}\s+(\d{2}:\d{2}):\d{2}$/;
const RE_DOSE = /^(\d+(?:[.,]\d+)?)\s*([A-Za-zµ]+\.?)/;

function righe(items: GsoItem[]): Riga[] {
  const ord = [...items].filter((i) => i.s.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const out: Riga[] = [];
  let cur: Riga | null = null;
  for (const i of ord) {
    if (!cur || cur.page !== i.page || Math.abs(cur.y - i.y) > 2.5) {
      cur = { y: i.y, page: i.page, it: [] };
      out.push(cur);
    }
    cur.it.push({ x: i.x, s: i.s.trim() });
  }
  return out;
}

const titolo = (s: string) => {
  const t = s.toLowerCase().replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const parole = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');

const ALIAS: Record<string, string> = {
  oxibutinina: 'ossibutinina', oxicodone: 'ossicodone', 'ossicodone': 'ossicodone', paracetamolo: 'paracetamolo',
  baclofen: 'baclofene', haloperidolo: 'aloperidolo', haloperidol: 'aloperidolo', morphine: 'morfina',
};
const SALI = /\b(cloridrato|dicloridrato|emifumarato|tartrato|maleato|fumarato|succinato|bromidrato|mesilato|besilato|sodico|sodica|calcico|calcica|sesquidrato|benzoato|medoxomil|monoidrato|diidrato|anidro|cl)\b|\bsale di \w+\b|\([^)]*\)/g;

export function pulisciPrincipio(raw: string): string {
  let t = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^macrogol/.test(t)) return 'Macrogol';
  t = t.replace(/potassio clavulanato/, 'acido clavulanico');
  const parti = t.split('/').map((p) => {
    let q = p.replace(SALI, ' ').replace(/\s+/g, ' ').trim();
    const w = q.split(' ');
    if (w.length >= 2 && /^(calcio|sodio|potassio|magnesio)$/.test(w[w.length - 1]) && !/^(calcio|sodio|potassio|magnesio|ferroso|zinco)$/.test(w[0])) q = w.slice(0, -1).join(' ');
    q = q.split(' ').map((w) => ALIAS[w] ?? w).join(' ');
    return q;
  }).filter(Boolean);
  t = parti.join('/');
  return titolo(t);
}

// ── Dosaggio e forma dal testo "Farmaco prescritto" ──────────────────────────
function normalizzaDosaggio(testo: string, conVolume: boolean): string | null {
  const s = testo.toUpperCase().replace(/,/g, '.').replace(/([A-Z%])(\d)/g, '$1 $2').replace(/(\d)([A-Z%])/g, '$1 $2');
  const forti: string[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(MG|MCG|µG|G|UI|MEQ|%)(?:\s*\/\s*(ML|G|DIE))?(?:\s*\+\s*(\d+(?:\.\d+)?)\s*(MG|MCG|G|UI))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[2] === 'G' && /\bBB\b|\bBUST/.test(s.slice(Math.max(0, m.index - 6), m.index))) continue;
    let d = `${m[1]} ${m[2].toLowerCase()}${m[3] ? '/' + m[3].toLowerCase() : ''}`;
    if (m[4]) d += `+${m[4]} ${m[5].toLowerCase()}`;
    forti.push(d.replace(/\./g, ','));
  }
  const filtrati = forti.some((d) => d.includes('/')) ? forti.filter((d) => d.includes('/') || !/ g$/.test(d)) : forti;
  let out = filtrati.join(' ');
  if (conVolume) {
    const v = s.match(/(\d{2,4})\s*ML/);
    if (v) out = `${out ? out + ' ' : ''}${v[1]} ml`;
  }
  return out.trim() || null;
}

function formaDa(testoFarmaco: string, unita: string, via: string | null): string {
  const t = testoFarmaco.toUpperCase();
  const u = unita.toLowerCase();
  const v = (via ?? '').toLowerCase();
  if (/^(gtt|gcc|gocce|gt)$/.test(u)) return /oftalm|auricol|nasal/.test(v) || /COLL/.test(t) ? 'collirio' : 'altro';
  if (/oftalm/.test(v) && /^(gtt|gcc|ml|applicazione|app)/.test(u)) return 'collirio';
  if (/oftalm/.test(v)) return 'collirio';
  if (u === 'cps' || /\d\s*CPS\b|\bCPS\b/.test(t)) return 'capsula';
  if (u === 'cp' || u === 'cpr' || /\bCPR\b|\d\s*CPR/.test(t)) return 'compressa';
  if (/^bust/.test(u) || /\bBUST/.test(t)) return 'bustina';
  if (/^cerott|^patch/.test(u) || /CEROTT|TTS|PATCH/.test(t)) return 'cerotto';
  if (/^sup/.test(u) || /SUPP/.test(t)) return 'supposte';
  if (/endoven|sottocute|intramusc/.test(v)) {
    if (/endoven/.test(v) && /(\b[1-9]\d{2,3}\s?ML\b|FLEBO|SACCA|FISIOLOG|\bNACL\b|GLUCOS|RINGER)/.test(t)) return 'flacone_infusione';
    return 'fiala';
  }
  if (/^(fl|fiala|fiale|f|sir|siringa)$/.test(u)) {
    if (/(\b[1-9]\d{2,3}\s?ML\b|FLEBO|SACCA|FISIOLOG|\bNACL\b|GLUCOS|RINGER)/.test(t)) return 'flacone_infusione';
    return /orale/.test(v) ? 'flacone' : 'fiala';
  }
  if (u === 'ml' && /orale/.test(v)) return 'sciroppo';
  if (/puff|dose|erog/.test(u)) return 'altro';
  return /orale|sublinguale|^$/.test(v) ? 'compressa' : 'altro';
}

const etichettaUnita = (u: string) => {
  const x = u.toLowerCase();
  if (x === 'cp' || x === 'cpr' || x === 'cps') return 'cp';
  if (/^bust/.test(x)) return 'bust';
  if (/^fial|^fl$|^f$/.test(x)) return 'fl';
  if (/^(gtt|gcc|gocce|gt)$/.test(x)) return 'gtt';
  return x;
};

// Integratori: nel PDF il nome è solo "INTEGRATORI"; il prodotto vero sta nell'indicazione.
// Se l'indicazione ne cita due con l'orario ("Normast ore 8 Sideral forte ore 13") si sceglie per ora.
const BRAND_INTEGRATORI = 'normast|sideral forte|aminotrofic|b-?vital neuro|liovital ad|fleben 1000|armolipid plus|osteosulfur|meritene';
function brandIntegratore(row: { indicazione: string[]; ora: string | null }): string {
  const ind = row.indicazione.join(' ');
  const trovati = [...ind.matchAll(new RegExp(`\\b(${BRAND_INTEGRATORI})\\b(?:\\s+ore\\s+(\\d{1,2}))?`, 'gi'))];
  if (!trovati.length) return '';
  if (trovati.length > 1 && row.ora) {
    const h = Number(row.ora.slice(0, 2));
    const m = trovati.find((t) => t[2] && Number(t[2]) === h);
    if (m) return m[1];
  }
  return trovati[0][1];
}

const fmtNum = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');

// ── Parser ───────────────────────────────────────────────────────────────────
export function parseTerapiaGSO(items: GsoItem[]): GsoRisultato {
  const avvisi: string[] = [];
  const R = righe(items);

  // colonne dalla riga di intestazione: le posizioni cambiano da pagina a pagina
  const heads = R.filter((r) => r.it.some((i) => /^Farmaco prescritto$/i.test(i.s)));
  if (!heads.length || !R.some((r) => r.it.some((i) => /^Paziente, codice/i.test(i.s)))) return { pazienti: [], avvisi: ['Formato non riconosciuto'], righe: 0 };
  type Anc = { F: number; P: number; D: number; M: number; O: number };
  const ancPag = new Map<number, Anc>();
  for (const h of heads) {
    const xOf = (re: RegExp, def: number) => h.it.find((i) => re.test(i.s))?.x ?? def;
    ancPag.set(h.page, { F: xOf(/^Farmaco prescritto$/i, 103), P: xOf(/^Principio attivo$/i, 271), D: xOf(/^Dose$/i, 460), M: xOf(/^Medico prescrivente$/i, 696), O: xOf(/^Orario previsto$/i, 784) });
  }
  const ultimaAnc = heads.length ? ancPag.get(heads[0].page)! : { F: 103, P: 271, D: 460, M: 696, O: 784 };
  const ancDi = (page: number): Anc => ancPag.get(page) ?? ultimaAnc;
  const col = (page: number, x: number): 'sx' | 'F' | 'P' | 'D' | 'V' | 'M' | 'O' => {
    const a = ancDi(page);
    return x < a.F - 8 ? 'sx' : x < a.P - 8 ? 'F' : x < a.D - 8 ? 'P' : x < a.D + 150 ? 'D' : x < a.M - 8 ? 'V' : x < a.O - 8 ? 'M' : 'O';
  };


  const recs: Rec[] = [];
  let rec: Rec | null = null;
  let via: string | null = null;
  let nomeBuf: string[] = [];
  let stanzaAcc: string | null = null;
  let pendingDose: string | null = null;
  let pendingPrn = false;
  let pendingInd: string[] = [];
  let ultima: Prescr | null = null;
  let righeTot = 0;

  for (const r of R) {
    // via di somministrazione (riga isolata a destra, sopra l'intestazione di colonna)
    const solo = r.it.length === 1 ? r.it[0] : null;
    if (solo && solo.x > ancDi(r.page).D + 60 && VIE.test(solo.s)) { via = titolo(solo.s); continue; }
    if (r.it.every((i) => /^(TERAPIA dalle|Stampato il)/i.test(i.s))) continue; // titolo di pagina
    if (r.it.some((i) => /^Farmaco prescritto$/i.test(i.s))) continue;

    const sx = r.it.filter((i) => col(r.page, i.x) === 'sx').map((i) => i.s);
    const F = r.it.filter((i) => col(r.page, i.x) === 'F').map((i) => i.s).join(' ');
    const P = r.it.filter((i) => col(r.page, i.x) === 'P').map((i) => i.s).join(' ');
    const D = r.it.filter((i) => col(r.page, i.x) === 'D').map((i) => i.s);
    const Mc = r.it.filter((i) => col(r.page, i.x) === 'M').map((i) => i.s).join(' ');
    const O = r.it.filter((i) => col(r.page, i.x) === 'O').map((i) => i.s);

    // ── colonna sinistra: paziente
    for (const t of sx) {
      if (/^(Pagina|Stampato|PDFium)/i.test(t) || /^(Paziente, codice|ospedalizzazione e posto|letto)$/i.test(t)) continue;
      const dob = t.match(RE_DOB);
      if (dob) {
        rec = { nominativo: nomeBuf.join(' ').replace(/\s+/g, ' ').trim(), dob: `${dob[3]}-${dob[2]}-${dob[1]}`, sdo: null, sala: null, letto: null, rows: [] };
        recs.push(rec); nomeBuf = []; stanzaAcc = null; ultima = null;
        continue;
      }
      const g = t.match(/(GSO_\d+)/);
      if (g) { if (rec) rec.sdo = g[1]; stanzaAcc = ''; nomeBuf = []; continue; }
      if (stanzaAcc !== null) {
        stanzaAcc += ' ' + t;
        const m = stanzaAcc.match(/-?\s*(.+?)\s*Posto\s+letto\s*(\d+)/i);
        if (m && rec) { rec.sala = m[1].replace(/^[-\s]+/, '').replace(/^Ricovero\s*-?\s*/i, '').trim(); rec.letto = Number(m[2]); stanzaAcc = null; }
        continue;
      }
      nomeBuf.push(t);
    }

    // ── colonna dose: quantità (può stare sopra la riga del farmaco, come per le terapie "al bisogno")
    let doseRiga: string | null = null;
    let prnRiga = false;
    const indRiga: string[] = [];
    for (const t of D) {
      if (/^Indicazione:/i.test(t)) indRiga.push(t.replace(/^Indicazione:\s*/i, ''));
      else if (/^(Intervallo|Note:)/i.test(t)) indRiga.push(t);
      else if (RE_DOSE.test(t) && !doseRiga) doseRiga = t;
      else if (indRiga.length && !/^\d/.test(t)) indRiga.push(t); // continuazione
    }
    if (O.some((t) => /al bisogno/i.test(t))) prnRiga = true;

    if (F && P) {
      // nuova prescrizione
      const ora = O.map((t) => t.match(RE_ORA)).find(Boolean);
      const p: Prescr = {
        farmaco: F, principio: P, dose: doseRiga ?? pendingDose, ora: ora ? ora[2] : null,
        prn: prnRiga || pendingPrn, indicazione: [...pendingInd, ...indRiga], via,
      };
      if (doseRiga && pendingDose && doseRiga !== pendingDose) avvisi.push(`${rec?.nominativo ?? '?'}: dose ambigua per ${F} (${doseRiga} / ${pendingDose}): verificare`);
      pendingDose = null; pendingPrn = false; pendingInd = [];
      if (!rec || !rec.nominativo) { avvisi.push(`Prescrizione senza paziente: ${F}`); continue; }
      rec.rows.push(p); ultima = p; righeTot++;
    } else if (F || P) {
      // continuazione di nome farmaco/principio andato a capo
      if (ultima) { if (F) ultima.farmaco += ' ' + F; if (P) ultima.principio += ' ' + P; }
      if (indRiga.length && ultima) ultima.indicazione.push(...indRiga);
    } else {
      // righe con solo dose / indicazioni / "al bisogno": appartengono alla prescrizione seguente (dose sopra)
      // oppure alla precedente (indicazioni sotto)
      if (doseRiga) { pendingDose = doseRiga; if (prnRiga) pendingPrn = true; }
      else if (prnRiga) pendingPrn = true;
      if (indRiga.length) { if (ultima && !pendingDose) ultima.indicazione.push(...indRiga); else pendingInd.push(...indRiga); }
    }
  }

  // ── aggregazione paziente × prodotto (ogni riga del PDF ha il suo blocco paziente: si riuniscono)
  type Gruppo = { p: Prescr; qty: { q: number; u: string; ora: string | null }[]; prn: boolean };
  const perPaziente = new Map<string, { paz: GsoPaziente; gruppi: Map<string, Gruppo> }>();
  for (const rc of recs) {
    if (!rc.rows.length) continue;
    const chiave = `${rc.sdo ?? ''}|${rc.nominativo}`;
    let e = perPaziente.get(chiave);
    if (!e) {
      e = { paz: { nominativo: rc.nominativo, numero_letto: rc.letto, sala: rc.sala, codice_sdo: rc.sdo, data_nascita: rc.dob, farmaci: [] }, gruppi: new Map() };
      perPaziente.set(chiave, e);
    }
    for (const row of rc.rows) {
      let q = 1, u = '';
      const d = row.dose ? row.dose.match(RE_DOSE) : null;
      if (d) { q = Number(d[1].replace(',', '.')); u = d[2].replace(/\.$/, ''); }
      else if (!row.prn) avvisi.push(`${rc.nominativo}: dose non leggibile per ${row.farmaco} (contata 1)`);
      const key = `${row.farmaco}|${row.principio}|${/^integrator/i.test(row.principio.trim()) ? brandIntegratore(row) : ''}|${row.prn}`;
      const g = e.gruppi.get(key) ?? { p: row, qty: [], prn: row.prn };
      g.qty.push({ q, u, ora: row.ora });
      if (row.indicazione.length && !g.p.indicazione.length) g.p.indicazione = row.indicazione;
      e.gruppi.set(key, g);
    }
  }

  const pazienti: GsoPaziente[] = [];
  for (const { paz, gruppi } of perPaziente.values()) {
    for (const g of gruppi.values()) {
      const [nomeRaw, ...resto] = g.p.farmaco.split('*');
      const confez = resto.join(' ') || g.p.farmaco;
      const integratore = /^integrator/i.test(g.p.principio.trim()) || /NORMAST|SIDERAL|MERITENE|ARMOLIPID|FLEBEN|OSTEOSULFUR|LIOVITAL|AMINOTROFIC|B-?VITAL|MELATONIN|CIRCADIN|VITAMIN|MAGNESIO SUPREMO/i.test(`${nomeRaw} ${g.p.principio}`);
      const unita = g.qty[0].u;
      const forma = formaDa(confez, unita || (/endoven|sottocute/i.test(g.p.via ?? '') ? 'Fl' : ''), g.p.via);
      const dosaggio = normalizzaDosaggio(confez, forma === 'flacone_infusione');
      let nome = nomeRaw && resto.length ? parole(nomeRaw) : null;
      let principio = pulisciPrincipio(g.p.principio);
      if (/^integrator/i.test(g.p.principio.trim())) {
        const ind = brandIntegratore(g.p);
        const brand = nome ?? (ind ? parole(ind) : null) ?? (nomeRaw && !/^integrator/i.test(nomeRaw) ? parole(nomeRaw) : null);
        principio = `Integratore – ${brand ?? 'Integratore non specificato'}`;
        nome = brand;
      } else if (/MERITENE/i.test(nomeRaw)) {
        principio = `Integratore – ${parole(nomeRaw)}`;
        nome = parole(nomeRaw);
      }
      const eu = etichettaUnita(unita || (forma === 'flacone_infusione' || forma === 'fiala' ? 'Fl' : ''));
      const ore = g.qty.map((x) => x.ora).filter(Boolean).sort() as string[];
      const stessa = g.qty.every((x) => x.q === g.qty[0].q);
      const note = g.p.indicazione.filter(Boolean).join(' · ') || null;
      let consumo: number, posologia: string;
      if (g.prn) {
        consumo = 0;
        posologia = `Al bisogno: ${fmtNum(g.qty[0].q)} ${eu}${note ? ' ' + note.replace(/\s*·\s*/g, ', ').toLowerCase() : ''}`.trim();
      } else {
        consumo = eu === 'gtt' ? g.qty.length : g.qty.reduce((s, x) => s + x.q, 0);
        posologia = stessa
          ? `${fmtNum(g.qty[0].q)} ${eu} x ${g.qty.length}/die${ore.length ? ` (${ore.join(', ')})` : ''}`
          : g.qty.map((x) => `${fmtNum(x.q)} ${eu}${x.ora ? ` (${x.ora})` : ''}`).join(' + ');
      }
      paz.farmaci.push({
        principio_attivo: principio,
        nome_commerciale: nome,
        forma_farmaceutica: forma,
        dosaggio,
        consumo_giornaliero: consumo,
        posologia,
        note: g.prn ? `Al bisogno (non in consumo fisso)${note ? ': ' + note : ''}` : (integratore ? 'Integratore: non fornito dalla farmacia' : note),
      });
    }
    pazienti.push(paz);
  }
  return { pazienti, avvisi, righe: righeTot };
}
