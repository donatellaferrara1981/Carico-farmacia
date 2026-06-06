/**
 * Configurazione delle sale del reparto GcA1 – Neuroriabilitazione.
 * Ogni sala ha un piano, un giorno di rifornimento e un colore UI.
 */

export interface Sala {
  id: string;        // chiave DB, es. "P0-S1"
  label: string;     // etichetta leggibile, es. "Piano 0 – Sala 1"
  piano: 0 | 1;
  giornoRifornimento: 'lunedì' | 'giovedì';
  colore: string;    // classe Tailwind per badge
}

export const SALE: Sala[] = [
  { id: 'P0-S1', label: 'Piano 0 – Sala 1', piano: 0, giornoRifornimento: 'lunedì',  colore: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'P0-S2', label: 'Piano 0 – Sala 2', piano: 0, giornoRifornimento: 'lunedì',  colore: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'P1-S1', label: 'Piano 1 – Sala 1', piano: 1, giornoRifornimento: 'giovedì', colore: 'bg-violet-100 text-violet-700 border-violet-200' },
  { id: 'P1-S2', label: 'Piano 1 – Sala 2', piano: 1, giornoRifornimento: 'giovedì', colore: 'bg-violet-100 text-violet-700 border-violet-200' },
  { id: 'P1-S3', label: 'Piano 1 – Sala 3', piano: 1, giornoRifornimento: 'giovedì', colore: 'bg-violet-100 text-violet-700 border-violet-200' },
];

export const SALA_BY_ID = Object.fromEntries(SALE.map((s) => [s.id, s])) as Record<string, Sala>;

export function getSala(id: string | null | undefined): Sala | null {
  return id ? (SALA_BY_ID[id] ?? null) : null;
}
