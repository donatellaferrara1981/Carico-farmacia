// Escape dei valori inseriti nei report HTML (stampa / archivio).
// Evita che testo libero (note, diagnosi, nomi) venga interpretato come HTML.
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
