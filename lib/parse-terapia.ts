import type { FormaFarmaceutica } from './prodotti';

export interface ProdottoEstratto {
  principio_attivo: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  consumo_giornaliero: number;
  note: string;
}

const FORMA_KEYWORDS: { keywords: string[]; forma: FormaFarmaceutica }[] = [
  {
    keywords: [
      'fiala', 'fiale', 'f.le', 'i.v.', 'i.m.', 'endovena', 'endovenosa',
      'intramuscolo', 'intramuscolare', 's.c.', 'sottocute', 'e.v.', ' ev ', ' im ', ' sc ',
      'soluzione iniettabile', 'iniett', 'per os ev', 'bolo ev',
    ],
    forma: 'fiala',
  },
  {
    keywords: [
      'flacone', 'flaconi', 'infusione', 'fisiologica', 'ringer', 'glucosata',
      'soluzione per infusione', 'elettrolitica', 'acqua per preparazioni', 'nacl',
      'sol.per inf', 'sol inf', 'sf ', 'soluzione fisiologica', 'glucos', 'sacca',
    ],
    forma: 'flacone_infusione',
  },
  {
    keywords: [
      'compressa', 'compresse', 'cpr', 'cps ', 'cp ', 'tabl', 'tablet',
      'orodispersibile', 'deglutire', 'masticabile', 'rilascio prolungato', 'gastroresistente',
    ],
    forma: 'compressa',
  },
  {
    keywords: ['capsula', 'capsule', 'caps'],
    forma: 'capsula',
  },
  {
    keywords: ['sciroppo', 'soluzione orale', 'gocce orali', 'sospensione orale', ' os '],
    forma: 'sciroppo',
  },
  {
    keywords: ['crema', 'unguento', 'gel ', 'pomata', 'cerotto', 'patch', 'topico', 'topica'],
    forma: 'crema',
  },
  {
    keywords: ['collirio', 'gocce oculari', 'gocce otologiche', 'oftalmico'],
    forma: 'collirio',
  },
  {
    keywords: ['supposta', 'supposte', 'supp', 'rettale'],
    forma: 'supposta',
  },
];

// Pattern dosaggio: cattura qualsiasi combinazione numero + unità
const DOSAGGIO_RE =
  /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ui|u\.i\.|ml|%|meq|mmol|mEq|MUI|UI|U\.I\.)(?:\s*\/\s*(?:\d+\s*)?(?:ml|g|l|die|kg|h|ora))?)/i;

function estraiDosaggio(testo: string): string {
  const m = testo.match(DOSAGGIO_RE);
  return m ? m[0].trim() : '';
}

function inferForma(riga: string, dosaggio: string): FormaFarmaceutica {
  const r = ' ' + riga.toLowerCase() + ' ';
  for (const { keywords, forma } of FORMA_KEYWORDS) {
    if (keywords.some((k) => r.includes(k.toLowerCase()))) return forma;
  }
  if (/\d+\s*ml|\d+\s*%/.test(dosaggio.toLowerCase())) return 'flacone_infusione';
  return 'compressa';
}

function stimaConsumo(riga: string): number {
  const xMatch = riga.match(/(\d+)\s*[xX×]/);
  if (xMatch) return parseInt(xMatch[1]);
  const volteMatch = riga.match(/(\d+)\s*volt/i);
  if (volteMatch) return parseInt(volteMatch[1]);
  const oreMatch = riga.match(/ogni\s+(\d+)\s+or/i);
  if (oreMatch) return Math.round(24 / parseInt(oreMatch[1]));
  const orari = riga.match(/\b\d{1,2}[:.]\d{2}\b/g);
  if (orari && orari.length > 0) return orari.length;
  return 1;
}

// Righe che sono sicuramente intestazioni/metadati, non farmaci
const SKIP_RE = /^(data|paziente|reparto|medico|infermiere|turno|mattino|pomeriggio|notte|firma|ora|orario|dose|note|mattina|sera|terapia|prescrizione|farmaco|posologia|nome|cognome|nato|nata|ricovero|scheda|foglio|pagina|piano|piano di|data di|n°|nr\.|num\.)$/i;

function rigaDaSkippare(r: string): boolean {
  if (r.length < 3) return true;
  if (SKIP_RE.test(r.trim())) return true;
  // Solo data
  if (/^\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?$/.test(r.trim())) return true;
  // Solo ora
  if (/^\d{1,2}[:. ]\d{2}$/.test(r.trim())) return true;
  // Solo numeri/simboli
  if (/^[\d\s\-_.,:;/|\\()[\]{}]+$/.test(r.trim())) return true;
  return false;
}

// Estrae il nome del farmaco: prende la parte prima del dosaggio
// e prima delle parole-chiave di forma
function estraiNome(riga: string, dosaggio: string): string {
  let nome = riga;

  // Taglia alla prima occorrenza del dosaggio
  if (dosaggio) {
    const idx = nome.toLowerCase().indexOf(dosaggio.toLowerCase());
    if (idx > 0) nome = nome.slice(0, idx);
  }

  // Taglia alle keyword di forma
  const r = nome.toLowerCase();
  for (const { keywords } of FORMA_KEYWORDS) {
    for (const k of keywords) {
      const ki = r.indexOf(k.toLowerCase());
      if (ki > 0) {
        nome = nome.slice(0, ki);
        break;
      }
    }
  }

  // Rimuovi prefissi numerici, trattini, asterischi
  nome = nome.replace(/^[\s\d\-_.*•·–—|/\\]+/, '');
  // Rimuovi suffissi non-alfabetici
  nome = nome.replace(/[\s\-_.*•·–—|/\\]+$/, '');
  // Normalizza spazi
  nome = nome.replace(/\s+/g, ' ').trim();

  return nome;
}

export function parseTerapiaText(testo: string): ProdottoEstratto[] {
  const righe = testo
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  for (const riga of righe) {
    if (rigaDaSkippare(riga)) continue;

    const dosaggio = estraiDosaggio(riga);

    // Accetta la riga se contiene un dosaggio OPPURE una parola-chiave di forma farmaceutica
    const haForma = FORMA_KEYWORDS.some(({ keywords }) =>
      keywords.some((k) => (' ' + riga.toLowerCase() + ' ').includes(k.toLowerCase()))
    );
    if (!dosaggio && !haForma) continue;

    const forma = inferForma(riga, dosaggio);
    const consumo = stimaConsumo(riga);
    let nome = estraiNome(riga, dosaggio);

    // Se il nome è troppo corto prova a prendere le prime parole significative della riga
    if (nome.length < 3) {
      const parole = riga
        .split(/\s+/)
        .filter((p) => /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(p))
        .slice(0, 3);
      nome = parole.join(' ');
    }

    if (nome.length < 3) continue;
    if (!/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(nome)) continue;

    // Capitalizza
    nome = nome.charAt(0).toUpperCase() + nome.slice(1);

    const chiave = nome.toLowerCase().replace(/\s+/g, '').slice(0, 25) + forma;
    if (visti.has(chiave)) continue;
    visti.add(chiave);

    prodotti.push({
      principio_attivo: nome,
      forma_farmaceutica: forma,
      dosaggio,
      consumo_giornaliero: consumo,
      note: '',
    });
  }

  return prodotti;
}
