import type { FormaFarmaceutica } from './prodotti';

export interface ProdottoEstratto {
  principio_attivo: string;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string;
  consumo_giornaliero: number;
  note: string;
}

// Mappa parole chiave → forma farmaceutica
const FORMA_KEYWORDS: { keywords: string[]; forma: FormaFarmaceutica }[] = [
  { keywords: ['fiala', 'fiale', 'f.le', 'fl.', 'im', 'ev', 'i.v.', 'i.m.', 'endovena', 'intramuscolo', 'sc', 's.c.'], forma: 'fiala' },
  { keywords: ['flacone', 'flac', 'infusione', 'fisiologica', 'ringer', 'glucosata', 'soluzione per infusione', 'elettrolitica', 'acqua per preparazioni', 'nacl', 'nacl 0.9'], forma: 'flacone_infusione' },
  { keywords: ['cpr', 'cps', 'compressa', 'compresse', 'cp', 'tabl', 'tablet'], forma: 'compressa' },
  { keywords: ['capsula', 'capsule', 'caps'], forma: 'capsula' },
  { keywords: ['sciroppo', 'soluzione orale', 'gocce orali', 'sospensione'], forma: 'sciroppo' },
  { keywords: ['crema', 'unguento', 'gel', 'pomata', 'cerotto'], forma: 'crema' },
  { keywords: ['collirio', 'gocce oculari', 'gocce otologiche'], forma: 'collirio' },
  { keywords: ['supposta', 'supposte', 'supp'], forma: 'supposta' },
];

// Forme per default basato su dosaggio
function inferForma(riga: string, dosaggio: string): FormaFarmaceutica {
  const r = riga.toLowerCase();
  for (const { keywords, forma } of FORMA_KEYWORDS) {
    if (keywords.some((k) => r.includes(k))) return forma;
  }
  // Se dosaggio è in ml o % → probabilmente flacone/fiala
  if (/\d+\s*ml|\d+\s*%/.test(dosaggio.toLowerCase())) return 'flacone_infusione';
  return 'compressa';
}

// Estrae il dosaggio da una stringa
function estraiDosaggio(testo: string): string {
  const match = testo.match(
    /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ui|u\.i\.|ml|%|meq|mmol|mEq)[\/\s]*(?:\d+\s*(?:ml|g|l))?)/i,
  );
  return match ? match[0].trim() : '';
}

// Conta quante volte appare un orario o una dose nella riga (stima consumo/die)
function stimaConsumo(riga: string): number {
  // Cerca pattern tipo "3x", "x2", "3 volte", ore separate da "+"
  const xMatch = riga.match(/(\d+)\s*[xX×]/);
  if (xMatch) return parseInt(xMatch[1]);
  const volteMatch = riga.match(/(\d+)\s*volt/i);
  if (volteMatch) return parseInt(volteMatch[1]);
  // Conta il numero di orari nel formato HH:MM o H.00
  const orari = riga.match(/\b\d{1,2}[:.]\d{2}\b/g);
  if (orari && orari.length > 0) return orari.length;
  return 1;
}

// Pulizia nome farmaco
function pulisciNome(nome: string): string {
  return nome
    .replace(/^\W+/, '')
    .replace(/\s+/g, ' ')
    .replace(/[*•·\-–—]/g, '')
    .trim();
}

export function parseTerapiaText(testo: string): ProdottoEstratto[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter(Boolean);
  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  for (const riga of righe) {
    // Salta righe troppo corte o che sembrano intestazioni/date
    if (riga.length < 4) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(riga)) continue;
    if (/^(data|paziente|reparto|medico|infermiere|turno|mattino|pomeriggio|notte|firma|ora|orario|dose|note)$/i.test(riga)) continue;

    const dosaggio = estraiDosaggio(riga);
    const forma = inferForma(riga, dosaggio);
    const consumo = stimaConsumo(riga);

    // Estrai il nome del farmaco: prima parola/gruppo prima del dosaggio o della forma
    let nome = riga;
    // Rimuovi il dosaggio dal nome
    if (dosaggio) nome = nome.replace(dosaggio, '');
    // Rimuovi keyword di forma
    for (const { keywords } of FORMA_KEYWORDS) {
      for (const k of keywords) {
        nome = nome.replace(new RegExp(`\\b${k}\\b`, 'gi'), '');
      }
    }
    // Rimuovi orari e numeri isolati
    nome = nome.replace(/\b\d{1,2}[:.]\d{2}\b/g, '');
    nome = nome.replace(/\b\d+\s*[xX×]\b/g, '');
    nome = nome.replace(/\b(ev|im|sc|os|sl|fl|cpr|cps)\b/gi, '');
    nome = pulisciNome(nome);

    // Salta se il nome risultante è troppo corto o numerico
    if (nome.length < 3 || /^\d+$/.test(nome)) continue;
    // Salta se non contiene lettere
    if (!/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(nome)) continue;

    const chiave = nome.toLowerCase().slice(0, 20) + forma;
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
