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
    keywords: ['fiala', 'fiale', 'f.le', 'fl.', 'i.v.', 'i.m.', 'endovena', 'endovenosa',
      'intramuscolo', 'intramuscolare', 's.c.', 'sottocute', 'e.v.', 'ev ', ' im ', 'soluzione iniettabile'],
    forma: 'fiala',
  },
  {
    keywords: ['flacone', 'flaconi', 'infusione', 'fisiologica', 'ringer', 'glucosata',
      'soluzione per infusione', 'elettrolitica', 'acqua per preparazioni', 'nacl', 'nacl 0.9',
      'sol.per inf', 'sol inf', 'sf ', 'soluzione fisiologica'],
    forma: 'flacone_infusione',
  },
  {
    keywords: ['compressa', 'compresse', 'cpr', 'cps ', 'cp ', 'tabl', 'tablet', 'orodispersibile',
      'deglutire', 'masticabile', 'rilascio prolungato', 'gastroresistente'],
    forma: 'compressa',
  },
  {
    keywords: ['capsula', 'capsule', 'caps'],
    forma: 'capsula',
  },
  {
    keywords: ['sciroppo', 'soluzione orale', 'gocce orali', 'sospensione orale', 'sciroppo', 'os '],
    forma: 'sciroppo',
  },
  {
    keywords: ['crema', 'unguento', 'gel', 'pomata', 'cerotto', 'patch', 'topico', 'topica'],
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

// Lista di farmaci comuni negli ospedali italiani per migliorare il riconoscimento
const FARMACI_NOTI = [
  'paracetamolo', 'acetaminofene', 'ibuprofene', 'ketoprofene', 'diclofenac', 'ketorolac',
  'tramadolo', 'morfina', 'ossicodone', 'fentanil', 'tapentadolo',
  'amoxicillina', 'ampicillina', 'piperacillina', 'tazobactam', 'ceftriaxone', 'cefazolina',
  'meropenem', 'imipenem', 'vancomicina', 'teicoplanina', 'linezolid', 'metronidazolo',
  'ciprofloxacina', 'levofloxacina', 'claritromicina', 'azitromicina', 'cotrimossazolo',
  'fluconazolo', 'amfotericina', 'aciclovir', 'ganciclovir',
  'omeprazolo', 'pantoprazolo', 'ranitidina', 'metoclopramide', 'ondansetron', 'domperidone',
  'furosemide', 'spironolattone', 'idroclorotiazide', 'mannitolo',
  'metoprololo', 'bisoprololo', 'atenololo', 'carvedilolo', 'amlodipina', 'nifedipina',
  'ramipril', 'enalapril', 'lisinopril', 'losartan', 'valsartan',
  'warfarin', 'eparina', 'enoxaparina', 'nadroparina', 'fondaparinux', 'dabigatran', 'rivaroxaban',
  'aspirina', 'acido acetilsalicilico', 'clopidogrel', 'ticagrelor',
  'insulina', 'metformina', 'glibenclamide', 'glipizide', 'sitagliptin',
  'levotiroxina', 'metimazolo', 'idrocortisone', 'desametasone', 'betametasone', 'prednisone',
  'metilprednisolone', 'prednisolone',
  'aloperidolo', 'risperidone', 'olanzapina', 'quetiapina', 'clozapina',
  'diazepam', 'lorazepam', 'midazolam', 'clonazepam', 'alprazolam', 'nitrazepam',
  'amitriptilina', 'sertralina', 'paroxetina', 'escitalopram', 'venlafaxina', 'duloxetina',
  'carbamazepina', 'valproato', 'acido valproico', 'fenitoina', 'levetiracetam', 'gabapentin',
  'baclofen', 'tizanidina', 'ciclobenzaprina',
  'calcio carbonato', 'calcio gluconato', 'potassio cloruro', 'sodio cloruro', 'magnesio solfato',
  'albumina', 'immunoglobuline', 'interferone', 'eritropoietina',
  'budesonide', 'beclometasone', 'salbutamolo', 'salmeterolo', 'formoterolo', 'tiotropio',
  'ipratropio', 'montelukast', 'aminofillina', 'teofillina',
  'atorvastatina', 'rosuvastatina', 'simvastatina', 'pravastatina',
  'allopurinolo', 'colchicina', 'metotrexato', 'ciclosporina', 'tacrolimus', 'micofenolato',
  'ossitocina', 'ergometrina', 'dinoprost',
  'atropina', 'neostigmina', 'sugammadex', 'propofol', 'ketamina', 'tiopentale', 'remifentanil',
  'noradrenalina', 'adrenalina', 'dopamina', 'dobutamina', 'vasopressina',
  'amiodarone', 'adenosina', 'digossina', 'verapamil', 'diltiazem',
  'nitroglicerina', 'isosorbide', 'nitroprussiato',
  'clorexidina', 'iodopovidone', 'betadine',
  'zinco ossido', 'vaselina', 'nistatin', 'clotrimazolo', 'miconazolo',
];

function inferForma(riga: string, dosaggio: string): FormaFarmaceutica {
  const r = riga.toLowerCase();
  for (const { keywords, forma } of FORMA_KEYWORDS) {
    if (keywords.some((k) => r.includes(k))) return forma;
  }
  if (/\d+\s*ml|\d+\s*%/.test(dosaggio.toLowerCase())) return 'flacone_infusione';
  return 'compressa';
}

function estraiDosaggio(testo: string): string {
  const match = testo.match(
    /\b(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|μg|g|ui|u\.i\.|ml|%|meq|mmol|mEq|MUI|UI|U\.I\.)(?:\s*\/\s*(?:\d+\s*)?(?:ml|g|l|die|kg))?)/i,
  );
  return match ? match[0].trim() : '';
}

function stimaConsumo(riga: string): number {
  const xMatch = riga.match(/(\d+)\s*[xX×]/);
  if (xMatch) return parseInt(xMatch[1]);
  const volteMatch = riga.match(/(\d+)\s*volt/i);
  if (volteMatch) return parseInt(volteMatch[1]);
  // Pattern "ogni X ore"
  const oreMatch = riga.match(/ogni\s+(\d+)\s+or/i);
  if (oreMatch) return Math.round(24 / parseInt(oreMatch[1]));
  const orari = riga.match(/\b\d{1,2}[:.]\d{2}\b/g);
  if (orari && orari.length > 0) return orari.length;
  return 1;
}

function pulisciNome(nome: string): string {
  return nome
    .replace(/^\W+/, '')
    .replace(/[*•·\-–—_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^[\d\s.]+/, '') // rimuovi numeri iniziali
    .trim();
}

// Controlla se la riga contiene un farmaco noto
function contieneNomeFarmacoNoto(riga: string): boolean {
  const r = riga.toLowerCase();
  return FARMACI_NOTI.some((f) => r.includes(f));
}

// Controlla se la riga sembra contenere info farmacologiche
function sembraFarmaco(riga: string): boolean {
  const r = riga.toLowerCase();
  // Contiene dosaggio
  if (/\d+\s*(?:mg|mcg|µg|g|ui|ml|%|meq)/i.test(r)) return true;
  // Contiene parole chiave forma farmaceutica
  if (FORMA_KEYWORDS.some(({ keywords }) => keywords.some((k) => r.includes(k)))) return true;
  // Contiene farmaco noto
  if (contieneNomeFarmacoNoto(r)) return true;
  return false;
}

// Righe da saltare
const RIGHE_SKIP = new Set([
  'data', 'paziente', 'reparto', 'medico', 'infermiere', 'turno',
  'mattino', 'pomeriggio', 'notte', 'firma', 'ora', 'orario', 'dose', 'note',
  'mattina', 'sera', 'terapia', 'prescrizione', 'farmaco', 'posologia',
  'via di somministrazione', 'nome', 'cognome', 'nato', 'nata', 'ricovero',
]);

function sembraIntestazione(riga: string): boolean {
  const r = riga.toLowerCase().trim();
  if (RIGHE_SKIP.has(r)) return true;
  // Data pura
  if (/^\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?$/.test(r)) return true;
  // Ora pura
  if (/^\d{1,2}[:. ]\d{2}$/.test(r)) return true;
  // Solo numeri
  if (/^\d+$/.test(r)) return true;
  // Troppo corta
  if (r.length < 3) return true;
  // Intestazione tipica di tabella
  if (/^(h\.|ore|n°|n\.|pz\.|paz\.)\s*\d/.test(r)) return true;
  return false;
}

export function parseTerapiaText(testo: string): ProdottoEstratto[] {
  const righe = testo
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

  const prodotti: ProdottoEstratto[] = [];
  const visti = new Set<string>();

  for (const riga of righe) {
    if (sembraIntestazione(riga)) continue;
    if (!sembraFarmaco(riga)) continue;

    const dosaggio = estraiDosaggio(riga);
    const forma = inferForma(riga, dosaggio);
    const consumo = stimaConsumo(riga);

    // Estrae il nome del farmaco
    let nome = riga;
    if (dosaggio) nome = nome.replace(dosaggio, '');
    for (const { keywords } of FORMA_KEYWORDS) {
      for (const k of keywords) {
        // Sostituisce keyword di forma (word boundary, case insensitive)
        nome = nome.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '');
      }
    }
    // Rimuovi orari, numeri isolati, abbreviazioni vie somm.
    nome = nome.replace(/\b\d{1,2}[:.]\d{2}\b/g, '');
    nome = nome.replace(/\b\d+\s*[xX×]\b/g, '');
    nome = nome.replace(/\b(ev|im|sc|os|sl|fl|cpr|cps|cp|e\.v\.|i\.v\.|i\.m\.|s\.c\.)\b/gi, '');
    nome = nome.replace(/\b(ogni|die|x die|pro die|al giorno)\b/gi, '');
    nome = pulisciNome(nome);

    // Prova a trovare il nome del farmaco noto nella riga originale
    if (nome.length < 3 || /^\d+$/.test(nome)) {
      const nomeTrovato = FARMACI_NOTI.find((f) => riga.toLowerCase().includes(f));
      if (nomeTrovato) {
        nome = nomeTrovato.charAt(0).toUpperCase() + nomeTrovato.slice(1);
      } else {
        continue;
      }
    }

    if (!/[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3,}/.test(nome)) continue;

    // Capitalizza prima lettera
    nome = nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();

    const chiave = nome.toLowerCase().replace(/\s+/g, '').slice(0, 20) + forma;
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
