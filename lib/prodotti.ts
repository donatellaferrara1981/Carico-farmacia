export const FORME_FARMACEUTICHE = [
  { value: 'compressa',        label: 'Compressa' },
  { value: 'capsula',          label: 'Capsula' },
  { value: 'fiala',            label: 'Fiala' },
  { value: 'crema',            label: 'Crema / Unguento' },
  { value: 'flacone_infusione',label: 'Flacone infusione' },
  { value: 'sciroppo',         label: 'Sciroppo / Soluzione orale' },
  { value: 'supposta',         label: 'Supposta' },
  { value: 'cerotto',          label: 'Cerotto transdermico' },
  { value: 'collirio',         label: 'Collirio / Gocce' },
  { value: 'altro',            label: 'Altro' },
] as const;

export type FormaFarmaceutica = (typeof FORME_FARMACEUTICHE)[number]['value'];

export interface Prodotto {
  id: string;
  org_id: string;
  categoria: string;
  principio_attivo: string;
  nome_commerciale: string | null;
  forma_farmaceutica: FormaFarmaceutica;
  dosaggio: string | null;
  quantita: number;
  consumo_giornaliero: number;
  note: string | null;
  nominativa: boolean;
  soglia_minima: number | null;
  data_scadenza: string | null;
  ciclo_totale: number | null;
  data_inizio_ciclo: string | null;
  sala: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProdottoConDocumenti extends Prodotto {
  documenti: {
    id: string;
    nome_file: string;
    storage_path: string;
    dimensione: number | null;
    created_at: string;
  }[];
}

export function formaLabel(v: string) {
  return FORME_FARMACEUTICHE.find((f) => f.value === v)?.label ?? v;
}

// Raggruppa per principio_attivo
export function raggruppaPer(
  prodotti: ProdottoConDocumenti[],
): Map<string, ProdottoConDocumenti[]> {
  const map = new Map<string, ProdottoConDocumenti[]>();
  for (const p of prodotti) {
    const key = p.principio_attivo.trim().toLowerCase();
    const display = p.principio_attivo.trim();
    if (!map.has(display)) {
      // usa display come chiave per preservare la capitalizzazione originale
      const existing = [...map.keys()].find((k) => k.toLowerCase() === key);
      if (existing) {
        map.get(existing)!.push(p);
      } else {
        map.set(display, [p]);
      }
    } else {
      map.get(display)!.push(p);
    }
  }
  return map;
}
