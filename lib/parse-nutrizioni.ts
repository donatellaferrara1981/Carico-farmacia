import type { FormaFarmaceutica } from './prodotti';
import type { ProdottoEstratto } from './parse-terapia';

// Keyword che identificano prodotti nutrizionali noti
const KEYWORD_BRAND = [
  'nutrison', 'ensure', 'fresubin', 'resource', 'isosource', 'novasource',
  'cubison', 'jevity', 'peptamen', 'osmolite', 'nepro', 'pulmocare',
  'vital', 'diason', 'glucerna', 'fortimel', 'fortijuice', 'fortisip',
  'diasip', 'survimed', 'reconvan', 'stresson', 'alitraq', 'impact',
  'supportan', 'renalcal', 'modulen', 'elemental', 'preop',
];

// Keyword generici per prodotti nutrizionali italiani
const KEYWORD_GENERICI = [
  'acqua gel', 'acqua gelif', 'crema', 'budino', 'mousse',
  'supplemento', 'integratore nutriz', 'formula enteral',
  'nutrizione enter', 'aliment', 'miscela',
];

// Pattern per quantità nutrizionali (volume, peso)
const QUANTITA_RE = /(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l\b|g\b|kg|kcal|kj)/i;

// Righe da saltare: intestazioni, totali, metadati
const SKIP_RE = /^(totale|tot\b|n\b|n°|cod(ice)?|descrizione|prodotto|quantità|qta|unità|data|fornitore|pagina|page|articolo|rep\.?|reparto|firma|emesso|stampato)/i;

function isRigaNutrizionale(riga: string): boolean {
  const lower = riga.toLowerCase();
  if (KEYWORD_BRAND.some((k) => lower.includes(k))) return true;
  if (KEYWORD_GENERICI.some((k) => lower.includes(k))) return true;
  if (QUANTITA_RE.test(riga) && /[a-zA-Z]{3,}/.test(riga)) return true;
  return false;
}

// Se la riga è CSV/TSV prende la colonna più ricca di testo
function normalizaRiga(riga: string): string {
  if (riga.includes(';')) {
    const cols = riga.split(';');
    return (cols.find((c) => /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(c)) ?? cols[0]).trim();
  }
  const tabs = riga.split('\t');
  if (tabs.length > 2) {
    return tabs.sort((a, b) => b.length - a.length)[0].trim();
  }
  return riga.trim();
}

function pulisciNome(s: string): string {
  return s
    .replace(/\s+\d+\s*(pz|pezzi|conf|confezioni?|scatol[ae]|bott\.?|flac\.?|vaset\.?)\s*$/i, '')
    .replace(/^\s*[\d\-\.\*\#]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(.)/, (c) => c.toUpperCase());
}

interface Classificato {
  forma: FormaFarmaceutica;
  dosaggio: string;
  nomeCompleto: string;
}

function classificaRiga(riga: string): Classificato {
  const lower = riga.toLowerCase();

  const qm = riga.match(QUANTITA_RE);
  const quantitaStr = qm ? `${qm[1].replace(',', '.')}${qm[2].toLowerCase()}` : '';
  const unitaMisura = qm?.[2]?.toLowerCase() ?? '';

  // Priorità 1: Acqua gel / acqua gelificata
  if (lower.includes('acqua gel') || lower.includes('acqua gelif')) {
    const nome = quantitaStr ? `Acqua gel ${quantitaStr}` : 'Acqua gel';
    return { forma: 'vasetto', dosaggio: 'vasetto', nomeCompleto: nome };
  }

  // Priorità 2: Crema / budino / mousse (dessert nutrizionale)
  if (lower.includes('crema') || lower.includes('budino') || lower.includes('mousse')) {
    return { forma: 'vasetto', dosaggio: 'vasetto', nomeCompleto: pulisciNome(riga) };
  }

  // Priorità 3: Bustine / polveri
  if (
    lower.includes('bustina') || lower.includes('sachet') ||
    lower.includes('polvere') || lower.includes('in polvere')
  ) {
    const dosaggio = quantitaStr || 'bustina';
    return { forma: 'sciroppo', dosaggio, nomeCompleto: pulisciNome(riga) };
  }

  // Priorità 4: Flaconi / liquidi
  if (
    lower.includes('flacone') || lower.includes('bottiglia') ||
    unitaMisura === 'ml' || unitaMisura === 'cl' || unitaMisura === 'dl' || unitaMisura === 'l'
  ) {
    return { forma: 'flacone_infusione', dosaggio: quantitaStr, nomeCompleto: pulisciNome(riga) };
  }

  // Default: considera flacone se ha quantità, altrimenti flacone generico
  return { forma: 'flacone_infusione', dosaggio: quantitaStr, nomeCompleto: pulisciNome(riga) };
}

export function parseNutrizioniText(testo: string): ProdottoEstratto[] {
  const righe = testo.split('\n').map((r) => r.trim()).filter((r) => r.length > 2);

  // Conta le occorrenze per chiave (nome+forma) — ogni riga = 1 prescrizione/paziente
  const conteggi = new Map<string, { prodotto: ProdottoEstratto; count: number }>();

  for (const rigaOriginale of righe) {
    if (SKIP_RE.test(rigaOriginale)) continue;

    const riga = normalizaRiga(rigaOriginale);
    if (riga.length < 3) continue;
    if (!isRigaNutrizionale(riga)) continue;

    const { forma, dosaggio, nomeCompleto } = classificaRiga(riga);
    if (nomeCompleto.length < 3) continue;

    const chiave = nomeCompleto.toLowerCase().replace(/\s+/g, '') + forma + dosaggio.toLowerCase().replace(/\s+/g, '');
    const esistente = conteggi.get(chiave);
    if (esistente) {
      esistente.count++;
    } else {
      conteggi.set(chiave, {
        count: 1,
        prodotto: {
          principio_attivo: nomeCompleto,
          nome_commerciale: '',
          forma_farmaceutica: forma,
          dosaggio,
          consumo_giornaliero: 1,
          note: '',
        },
      });
    }
  }

  return Array.from(conteggi.values()).map(({ prodotto, count }) => ({
    ...prodotto,
    consumo_giornaliero: count,
  }));
}
