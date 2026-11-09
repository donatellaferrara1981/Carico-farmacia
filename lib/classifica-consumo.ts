// Classificazione dei farmaci per il calcolo del consumo giornaliero:
// categoria di forma farmaceutica (come si legge in reparto) e integratori.
// Tutto in un posto solo, così è facile correggere le parole chiave.

export type ClasseForma =
  | 'compresse' | 'gocce' | 'sciroppi' | 'bustine' | 'fiale' | 'infusione'
  | 'inalatori' | 'colliri' | 'creme' | 'cerotti' | 'supposte' | 'altro';

// Ordine di visualizzazione e titoli
export const CLASSI_FORMA: { id: ClasseForma; label: string }[] = [
  { id: 'compresse', label: 'Compresse e capsule' },
  { id: 'gocce',     label: 'Gocce orali' },
  { id: 'sciroppi',  label: 'Sciroppi e soluzioni orali' },
  { id: 'bustine',   label: 'Bustine da bere' },
  { id: 'fiale',     label: 'Fiale e iniettabili' },
  { id: 'infusione', label: 'Flaconi e sacche per infusione' },
  { id: 'inalatori', label: 'Puff inalatori e aerosol' },
  { id: 'colliri',   label: 'Colliri e gocce oculari/auricolari' },
  { id: 'creme',     label: 'Creme, unguenti e gel' },
  { id: 'cerotti',   label: 'Cerotti transdermici' },
  { id: 'supposte',  label: 'Supposte' },
  { id: 'altro',     label: 'Altre forme' },
];

interface DatiForma {
  principio_attivo: string;
  nome_commerciale?: string | null;
  forma_farmaceutica?: string | null;
  dosaggio?: string | null;
  note?: string | null;
}

const testo = (p: DatiForma) =>
  [p.principio_attivo, p.nome_commerciale, p.dosaggio, p.note].filter(Boolean).join(' ').toLowerCase();

export function classeForma(p: DatiForma): ClasseForma {
  const t = testo(p);
  const f = (p.forma_farmaceutica ?? '').toLowerCase();

  if (/puff|inalator|\bspray\b|aerosol|nebuliz|erogat|turbohaler|diskus|\bmdi\b/.test(t)) return 'inalatori';
  if (/\bbust|bustin|granulat|\bos polv/.test(t)) return 'bustine';
  if (/collir|oftalm|oculare|oculari|auricolar/.test(t) || (f === 'collirio' && !/gocce/.test(t))) return 'colliri';
  if (/\bgocce\b|\bgtt\b/.test(t)) return 'gocce';
  if (/cerott|patch|transderm/.test(t) || f === 'cerotto') return 'cerotti';
  if (/suppost|rettale/.test(t) || f === 'supposta') return 'supposte';
  if (f === 'flacone_infusione' || /infusione|\bsacca\b|fisiologica|glucosata|ringer/.test(t)) return 'infusione';
  if (f === 'fiala' || /\bfial|iniett|\bi\.?v\.?\b|\bi\.?m\.?\b|\bs\.?c\.?\b|endoven|sottocute/.test(t)) return 'fiale';
  if (f === 'compressa' || f === 'capsula' || /\bcpr\b|compress|capsul|\bcps\b/.test(t)) return 'compresse';
  if (f === 'sciroppo' || /sciropp|soluzione orale|sospensione orale|\bsol or\b/.test(t)) return 'sciroppi';
  if (f === 'crema' || /crema|unguent|pomata|\bgel\b/.test(t)) return 'creme';
  return 'altro';
}

// Integratori: non li fornisce la farmacia, vanno tenuti a parte.
const INTEGRATORE_RE = /integrator|vitamin|multivit|polivit|probiotic|fermenti lattici|omega ?-?3|sali minerali|melatonin/i;

export function isIntegratore(p: DatiForma): boolean {
  return INTEGRATORE_RE.test(testo(p));
}
