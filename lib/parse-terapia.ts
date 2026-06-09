import type { FormaFarmaceutica } from './prodotti';

export interface ProdottoEstratto {
  principio_attivo: string;
  nome_commerciale: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  consumo_giornaliero: number;
  note: string;
}

// ── Costanti ─────────────────────────────────────────────────────────────────

const VIA_FORMA: Record<string, FormaFarmaceutica> = {
  'orale': 'compressa', 'per os': 'compressa',
  'sottocute': 'fiala', 'endovenosa': 'fiala', 'endovena': 'fiala',
  'cutanea': 'crema', 'topica': 'crema',
  'rettale': 'supposta',
  'oftalmica': 'collirio', 'auricolare': 'collirio',
  'inalatoria': 'sciroppo',
  'intramuscolare': 'fiala', 'intramuscolo': 'fiala',
  'infusione': 'flacone_infusione', 'endovenosa lenta': 'flacone_infusione',
};

const CODICE_FORMA: Record<string, FormaFarmaceutica> = {
  'CPR': 'compressa', 'CPR RIV': 'compressa', 'CPR DIV': 'compressa', 'CPR GAST': 'compressa',
  'CPS': 'capsula', 'CPS GASTR': 'capsula', 'CPS MOLLI': 'capsula',
  'SIR': 'fiala', 'FL': 'fiala', 'FLI': 'fiala', 'FIALA': 'fiala',
  'BUST': 'sciroppo', 'OS POLV': 'sciroppo', 'GOCCE': 'sciroppo', 'SOL OR': 'sciroppo',
  'UNG': 'crema', 'CREMA': 'crema', 'GEL': 'crema', 'CEROTTO': 'crema', 'PATCH': 'crema',
  'COLL': 'collirio', 'SUPP': 'supposta',
};

const FORMA_KEYWORDS: { keywords: string[]; forma: FormaFarmaceutica }[] = [
  { keywords: ['fiala', 'fiale', 'i.v.', 'i.m.', 'endovena', 's.c.', 'sottocute', ' ev ', ' im ', ' sc ', 'iniett'], forma: 'fiala' },
  { keywords: ['flacone', 'infusione', 'fisiologica', 'ringer', 'glucosata', 'nacl', 'sacca'], forma: 'flacone_infusione' },
  { keywords: ['compressa', 'compresse', 'cpr', 'orodispersibile'], forma: 'compressa' },
  { keywords: ['capsula', 'capsule', 'caps'], forma: 'capsula' },
  { keywords: ['sciroppo', 'soluzione orale', 'gocce orali', 'sospensione orale'], forma: 'sciroppo' },
  { keywords: ['crema', 'unguento', 'gel ', 'pomata', 'cerotto', 'patch'], forma: 'crema' },
  { keywords: ['collirio', 'gocce oculari', 'oftalmico'], forma: 'collirio' },
  { keywords: ['supposta', 'supposte', 'rettale'], forma: 'supposta' },
];

const DOSAGGIO_RE = /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ui|u\.i\.|ml|%|meq|mmol|mEq|MUI|UI)(?:\s*\/\s*(?:\d+\s*)?(?:ml|g|l|die|kg|h))?)/i;

// Sigle via di somministrazione da ignorare
const SKIP_RIGHE = new Set([
  'im', 'iv', 'ev', 'sc', 'sl', 'os', 'po', 'pr', 'top', 'oc', 'au', 'nas', 'inh',
  'i.m.', 'i.v.', 'e.v.', 's.c.', 'p.o.', 'per os',
]);

// Pattern righe da scartare (NON farmaci)
const SKIP_PATTERN = /^(BOLO|Paziente|Farmaco\s+prescritto|Principio\s+attivo|Dose|Medico|Orario|Somministrazione|Effettuata|Indicazione|TERAPIA\s|PDFium|Tempo\s+di|Velocit|Diluizione|Nota|Note|richiesta\s+farmac|scheda\s|modulo\s|data\s+di|ora\s+di|quantit|unit|confezioni|totale|stanza|sala\s|piano\s|reparto|firma|dott|inferm|operatore)/i;

// Parole che da sole non identificano un farmaco
const NON_FARMACO = /^(si|no|ok|nd|nr|np|nb|cf|vd|vs|mattino|pomeriggio|notte|sera|colazione|pranzo|cena|digiuno|prima|dopo|durante|ogni|vedere|vedi|come|somministr|diluire|infondere|continua|sospend|riduci|aumenta|urgente|stat|prn)$/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function estraiFormaCommerciale(nome: string): FormaFarmaceutica | null {
  const upper = nome.toUpperCase();
  const parte = upper.includes('*') ? upper.split('*')[1] ?? '' : upper;
  for (const [codice, forma] of Object.entries(CODICE_FORMA)) {
    if (parte.includes(codice)) return forma as FormaFarmaceutica;
  }
  return null;
}

function estraiDosaggioCommerciale(nome: string): string {
  const m = nome.match(/(\d+(?:[.,]\d+)?\s*(?:MG|MCG|µG|G|UI|U\.I\.|ML|%|MEQ|MMOL|MUI)(?:\s*\/\s*\d*\s*(?:ML|G|L))?)/i);
  return m ? m[0].trim() : '';
}

function normalizzaNome(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

// Chiave deduplicazione — usa l'intero principio attivo, non troncato
function chiaveDedup(pa: string, forma: string, dosaggio: string): string {
  return [
    pa.toLowerCase().replace(/\s+/g, ' ').trim(),
    forma,
    dosaggio.toLowerCase().replace(/\s+/g, ''),
  ].join('|');
}

// Conta le somministrazioni giornaliere da frasi tipo "1 cp x 3/die", "2 fiale/die", ecc.
function estraiConsumoGiornaliero(contesto: string[]): number {
  const testo = contesto.join(' ').toLowerCase();

  // Pattern espliciti: "3 volte al giorno", "3/die", "tre volte"
  const patterns: [RegExp, number][] = [
    [/(\d+)\s*(?:cp|cpr|cps|caps|fiale?|fl|pz|conf|bust|gtt|puff|supp?|cerott)\s*(?:x|×|per)\s*(\d+)\s*(?:\/die|\/giorno|al\s*giorno)/i, -1], // m[1]*m[2]
    [/(\d+)\s*(?:\/die|\/giorno|al\s*giorno|volte\s*(?:al\s*)?giorno|somministrazioni\s*(?:al\s*)?giorno)/i, 1],
    [/(?:x|×|per)\s*(\d+)\s*(?:\/die|\/giorno|al\s*giorno)/i, 1],
    [/(\d+)\s*(?:cp|cpr|cps|caps|fiale?|fl|pz)\s+(?:mattino|sera|notte|pomeriggio)/i, 1],
    [/(\d+)\s*x\s*al\s*giorno/i, 1],
  ];

  for (const [re, mode] of patterns) {
    const m = testo.match(re);
    if (m) {
      if (mode === -1) {
        // prodotto dei due gruppi catturati
        const q = parseInt(m[1] ?? '1');
        const freq = parseInt(m[2] ?? '1');
        if (!isNaN(q) && !isNaN(freq)) return q * freq;
      } else {
        const v = parseInt(m[1] ?? '1');
        if (!isNaN(v) && v > 0 && v <= 24) return v;
      }
    }
  }

  // Conta parole chiave temporali come proxy
  const volte =
    (testo.includes('mattino') || testo.includes('mattina') ? 1 : 0) +
    (testo.includes('pomeriggio') ? 1 : 0) +
    (testo.includes('sera') ? 1 : 0) +
    (testo.includes('notte') ? 1 : 0);

  return volte > 0 ? volte : 1;
}

// Verifica che la stringa sembri davvero un principio attivo farmaceutico
function isPrincipioAttivoValido(s: string): boolean {
  if (s.length < 4 || s.length > 90) return false;
  if (SKIP_RIGHE.has(s.toLowerCase().trim())) return false;
  if (SKIP_PATTERN.test(s)) return false;
  if (NON_FARMACO.test(s.trim())) return false;
  // Deve contenere almeno 4 lettere consecutive
  if (!/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{4,}/.test(s)) return false;
  // Non deve essere solo numeri/punteggiatura
  if (/^[\d\s\/\-\.,:;]+$/.test(s)) return false;
  // Non deve essere una riga di soli numeri orari o date
  if (/^\d{1,2}[:.]\d{2}/.test(s)) return false;
  return true;
}

// ── Parser STRUTTURATO (PDF clinico ospedaliero con asterisco) ────────────────

function parseTerapiaStrutturato(testo: string): ProdottoEstratto[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter(Boolean);
  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  let viaCorrente: FormaFarmaceutica = 'compressa';

  const isNomeCommerciale = (r: string) =>
    /\*/.test(r) && /[A-Z]{3,}/.test(r) && !r.startsWith('GSO_') && !SKIP_PATTERN.test(r);

  const isPrincipioAttivoRiga = (r: string) =>
    /^[A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ\s\/\-\+0-9]+$/.test(r) &&
    isPrincipioAttivoValido(r) &&
    !r.includes('*') &&
    !r.startsWith('GSO_') &&
    !r.startsWith('Stanza');

  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];

    const viaKey = r.toLowerCase().trim();
    if (VIA_FORMA[viaKey]) { viaCorrente = VIA_FORMA[viaKey]; continue; }
    if (!isNomeCommerciale(r)) continue;

    const nomeCommerciale = r;
    const dosaggio = estraiDosaggioCommerciale(nomeCommerciale);
    const forma = estraiFormaCommerciale(nomeCommerciale) ?? viaCorrente;

    // Riga successiva = principio attivo
    let principioAttivo = '';
    if (i + 1 < righe.length && isPrincipioAttivoRiga(righe[i + 1])) {
      principioAttivo = righe[i + 1].trim();
      i++;
    }

    if (!principioAttivo || !isPrincipioAttivoValido(principioAttivo)) {
      const parteNome = nomeCommerciale.split('*')[0].trim();
      if (parteNome.length >= 4) principioAttivo = parteNome;
      else continue;
    }

    principioAttivo = normalizzaNome(principioAttivo);

    // Raccoglie le righe di contesto successive per calcolare consumo
    const contesto: string[] = [nomeCommerciale];
    for (let j = i + 1; j < Math.min(i + 6, righe.length); j++) {
      contesto.push(righe[j]);
    }
    const consumo = estraiConsumoGiornaliero(contesto);

    const chiave = chiaveDedup(principioAttivo, forma, dosaggio);
    if (visti.has(chiave)) {
      // Stesso farmaco già visto — accumula consumo (paziente ripetuto)
      const esistente = prodotti.find(p => chiaveDedup(p.principio_attivo, p.forma_farmaceutica, p.dosaggio) === chiave);
      if (esistente) esistente.consumo_giornaliero += consumo;
      continue;
    }
    visti.add(chiave);

    const nomeCommercialePulito = nomeCommerciale.split('*')[0].trim().split(/\s+/)[0];
    const nomeCommercialeFmt = nomeCommercialePulito.charAt(0).toUpperCase() + nomeCommercialePulito.slice(1).toLowerCase();

    prodotti.push({
      principio_attivo: principioAttivo,
      nome_commerciale: nomeCommercialeFmt,
      forma_farmaceutica: forma,
      dosaggio,
      consumo_giornaliero: consumo,
      note: '',
    });
  }

  return prodotti;
}

// ── Parser GENERICO di fallback ───────────────────────────────────────────────

function parseTerapiaGenerico(testo: string): ProdottoEstratto[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter(Boolean);
  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  for (let i = 0; i < righe.length; i++) {
    const riga = righe[i];

    if (!isPrincipioAttivoValido(riga)) continue;

    const dosaggio = (riga.match(DOSAGGIO_RE) ?? [])[0]?.trim() ?? '';
    const haForma = FORMA_KEYWORDS.some(({ keywords }) =>
      keywords.some((k) => (' ' + riga.toLowerCase() + ' ').includes(k))
    );
    if (!dosaggio && !haForma) continue;

    const forma = (() => {
      const r = ' ' + riga.toLowerCase() + ' ';
      for (const { keywords, forma } of FORMA_KEYWORDS) {
        if (keywords.some((k) => r.includes(k))) return forma;
      }
      return 'compressa' as FormaFarmaceutica;
    })();

    let nome = riga;
    if (dosaggio) {
      const idx = nome.toLowerCase().indexOf(dosaggio.toLowerCase());
      if (idx > 0) nome = nome.slice(0, idx);
    }
    nome = nome.replace(/^[\s\d\-_.*•·–—|/\\]+/, '').replace(/[\s\d\-_.*•·–—|/\\]+$/, '').replace(/\s+/g, ' ').trim();
    if (!isPrincipioAttivoValido(nome)) continue;

    nome = normalizzaNome(nome);

    const contesto = righe.slice(i, Math.min(i + 5, righe.length));
    const consumo = estraiConsumoGiornaliero(contesto);

    const chiave = chiaveDedup(nome, forma, dosaggio);
    if (visti.has(chiave)) {
      const esistente = prodotti.find(p => chiaveDedup(p.principio_attivo, p.forma_farmaceutica, p.dosaggio) === chiave);
      if (esistente) esistente.consumo_giornaliero += consumo;
      continue;
    }
    visti.add(chiave);

    prodotti.push({
      principio_attivo: nome,
      nome_commerciale: '',
      forma_farmaceutica: forma,
      dosaggio,
      consumo_giornaliero: consumo,
      note: '',
    });
  }

  return prodotti;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function parseTerapiaText(testo: string): ProdottoEstratto[] {
  const strutturati = parseTerapiaStrutturato(testo);
  if (strutturati.length > 0) return strutturati;
  return parseTerapiaGenerico(testo);
}
