import type { FormaFarmaceutica } from './prodotti';

export interface ProdottoEstratto {
  principio_attivo: string;
  nome_commerciale: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  consumo_giornaliero: number;
  note: string;
}

// Mappa via di somministrazione → forma farmaceutica
const VIA_FORMA: Record<string, FormaFarmaceutica> = {
  'orale': 'compressa',
  'sottocute': 'fiala',
  'endovenosa': 'fiala',
  'endovena': 'fiala',
  'cutanea': 'crema',
  'topica': 'crema',
  'rettale': 'supposta',
  'oftalmica': 'collirio',
  'auricolare': 'collirio',
  'inalatoria': 'sciroppo',
  'intramuscolare': 'fiala',
  'intramuscolo': 'fiala',
  'infusione': 'flacone_infusione',
  'endovenosa lenta': 'flacone_infusione',
};

// Codici forma nel nome commerciale (LYRICA*100CPS → capsula)
const CODICE_FORMA: Record<string, FormaFarmaceutica> = {
  'CPR': 'compressa', 'CPR RIV': 'compressa', 'CPR DIV': 'compressa', 'CPR GAST': 'compressa',
  'CPS': 'capsula', 'CPS GASTR': 'capsula', 'CPS MOLLI': 'capsula',
  'SIR': 'fiala', 'FL': 'fiala', 'FLI': 'fiala', 'FIALA': 'fiala',
  'BUST': 'sciroppo', 'OS POLV': 'sciroppo', 'GOCCE': 'sciroppo', 'SOL OR': 'sciroppo',
  'UNG': 'crema', 'CREMA': 'crema', 'GEL': 'crema', 'CEROTTO': 'crema', 'PATCH': 'crema',
  'COLL': 'collirio', 'SUPP': 'supposta',
};

// Righe da ignorare nel parser strutturato
const SKIP_PATTERN = /^(BOLO|Paziente|Farmaco prescritto|Principio attivo|Dose|Medico|Orario|Somministrazione|Effettuata|Indicazione:|TERAPIA |PDFium)/i;

function estraiFormaCommerciale(nome: string): FormaFarmaceutica | null {
  const upper = nome.toUpperCase();
  const dopoPuntatore = upper.includes('*') ? upper.split('*')[1] ?? '' : upper;
  for (const [codice, forma] of Object.entries(CODICE_FORMA)) {
    if (dopoPuntatore.includes(codice)) return forma as FormaFarmaceutica;
  }
  return null;
}

function estraiDosaggioCommerciale(nome: string): string {
  const m = nome.match(/(\d+(?:[.,]\d+)?\s*(?:MG|MCG|µG|G|UI|U\.I\.|ML|%|MEQ|MMOL|MUI)(?:\s*\/\s*\d*\s*(?:ML|G|L))?)/i);
  return m ? m[0].trim() : '';
}

// Parser STRUTTURATO per il formato PDF clinico ospedaliero
// Struttura: Nome commerciale → Principio attivo → Dose → Medico → Data/ora
function parseTerapiaStrutturato(testo: string): ProdottoEstratto[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter(Boolean);
  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  let viaCorrente: FormaFarmaceutica = 'compressa';

  // Riga nome commerciale: contiene * e lettere maiuscole (es: LYRICA*100CPS 75MG)
  const isNomeCommerciale = (r: string) => /\*/.test(r) && /[A-Z]{3,}/.test(r) && !r.startsWith('GSO_');
  // Principio attivo: tutto maiuscolo, no numeri, no asterischi
  const isPrincipioAttivo = (r: string) =>
    /^[A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙ\s\/\-0-9]+$/.test(r) &&
    r.length >= 3 && r.length <= 80 &&
    !SKIP_PATTERN.test(r) &&
    !r.includes('*') &&
    !r.startsWith('GSO_') &&
    !r.startsWith('Stanza');

  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];

    // Aggiorna la via di somministrazione corrente
    const viaKey = r.toLowerCase().trim();
    if (VIA_FORMA[viaKey]) {
      viaCorrente = VIA_FORMA[viaKey];
      continue;
    }

    if (!isNomeCommerciale(r)) continue;

    const nomeCommerciale = r;
    const dosaggio = estraiDosaggioCommerciale(nomeCommerciale);
    const formaCommerciale = estraiFormaCommerciale(nomeCommerciale);
    const forma = formaCommerciale ?? viaCorrente;

    // La riga successiva dovrebbe essere il principio attivo
    let principioAttivo = '';
    if (i + 1 < righe.length && isPrincipioAttivo(righe[i + 1]) && !SKIP_PATTERN.test(righe[i + 1])) {
      principioAttivo = righe[i + 1].trim();
      i++;
    }

    if (!principioAttivo || principioAttivo.length < 3) {
      // Fallback: usa il nome commerciale senza asterisco e codice
      const parteNome = nomeCommerciale.split('*')[0].trim();
      if (parteNome.length >= 3) principioAttivo = parteNome;
      else continue;
    }

    // Normalizza maiuscole: Prima lettera maiuscola, resto minuscolo
    principioAttivo = principioAttivo
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const chiave = principioAttivo.toLowerCase().replace(/\s+/g, '').slice(0, 25) + forma + (dosaggio.toLowerCase().replace(/\s+/g, ''));
    if (visti.has(chiave)) continue;
    visti.add(chiave);

    // Estrai nome commerciale pulito (es. "LYRICA*100CPS 75MG" → "Lyrica")
    const nomeCommercialePulito = nomeCommerciale
      .split('*')[0]
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase());

    prodotti.push({
      principio_attivo: principioAttivo,
      nome_commerciale: nomeCommercialePulito,
      forma_farmaceutica: forma,
      dosaggio,
      consumo_giornaliero: 1,
      note: '',
    });
  }

  return prodotti;
}

// Parser GENERICO di fallback (per PDF non strutturati)
const FORMA_KEYWORDS: { keywords: string[]; forma: FormaFarmaceutica }[] = [
  { keywords: ['fiala', 'fiale', 'i.v.', 'i.m.', 'endovena', 's.c.', 'sottocute', ' ev ', ' im ', ' sc ', 'iniett'], forma: 'fiala' },
  { keywords: ['flacone', 'infusione', 'fisiologica', 'ringer', 'glucosata', 'nacl', 'sacca'], forma: 'flacone_infusione' },
  { keywords: ['compressa', 'compresse', 'cpr', 'cps ', 'tabl', 'orodispersibile'], forma: 'compressa' },
  { keywords: ['capsula', 'capsule', 'caps'], forma: 'capsula' },
  { keywords: ['sciroppo', 'soluzione orale', 'gocce orali', 'sospensione orale'], forma: 'sciroppo' },
  { keywords: ['crema', 'unguento', 'gel ', 'pomata', 'cerotto', 'patch'], forma: 'crema' },
  { keywords: ['collirio', 'gocce oculari', 'oftalmico'], forma: 'collirio' },
  { keywords: ['supposta', 'supposte', 'rettale'], forma: 'supposta' },
];

const DOSAGGIO_RE = /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ui|u\.i\.|ml|%|meq|mmol|mEq|MUI|UI)(?:\s*\/\s*(?:\d+\s*)?(?:ml|g|l|die|kg|h))?)/i;

function parseTerapiaGenerico(testo: string): ProdottoEstratto[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter(Boolean);
  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  for (const riga of righe) {
    if (riga.length < 3) continue;
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
    if (dosaggio) { const idx = nome.toLowerCase().indexOf(dosaggio.toLowerCase()); if (idx > 0) nome = nome.slice(0, idx); }
    nome = nome.replace(/^[\s\d\-_.*•·–—|/\\]+/, '').replace(/[\s\d\-_.*•·–—|/\\]+$/, '').replace(/\s+/g, ' ').trim();
    if (nome.length < 3 || !/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(nome)) continue;

    nome = nome.charAt(0).toUpperCase() + nome.slice(1);
    const chiave = nome.toLowerCase().replace(/\s+/g, '').slice(0, 25) + forma + (dosaggio.toLowerCase().replace(/\s+/g, ''));
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    prodotti.push({ principio_attivo: nome, nome_commerciale: '', forma_farmaceutica: forma, dosaggio, consumo_giornaliero: 1, note: '' });
  }
  return prodotti;
}

export function parseTerapiaText(testo: string): ProdottoEstratto[] {
  // Prima tenta il parser strutturato (formato PDF clinico ospedaliero)
  const strutturati = parseTerapiaStrutturato(testo);
  if (strutturati.length > 0) return strutturati;

  // Fallback: parser generico
  return parseTerapiaGenerico(testo);
}
