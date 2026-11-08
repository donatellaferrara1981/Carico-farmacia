// Il nominativo nel DB è "COGNOME NOME" (es. "SANFILIPPO ANGELO", "DI MARIA LOREDANA").
// Cognomi composti con particella (DI, DE, LO, LA, ...) vengono riconosciuti;
// un cognome doppio senza particella non è distinguibile dal nome e resta alla sola prima parola.
const PARTICELLE = new Set([
  'DI', 'DE', 'DEL', 'DELLA', 'DELLO', 'DEI', 'DEGLI', 'DELLE',
  'LO', 'LA', 'LE', 'LI', 'DA', 'DAL', 'DALLA', 'DALLE', 'DAI',
  'VAN', 'VON', 'SAN', 'SANTA', 'MC', 'MAC',
]);

export function cognomePaziente(nominativo: string): string {
  const tk = nominativo.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (tk.length <= 1) return tk[0] ?? '';
  let n = 1;
  // include le particelle e la parola successiva, lasciando sempre almeno una parola per il nome
  while (n < tk.length - 1 && PARTICELLE.has(tk[n - 1].toUpperCase())) n++;
  return tk.slice(0, n).join(' ');
}

// Etichette per un elenco di pazienti: cognome, con l'iniziale del nome se due cognomi coincidono.
export function etichettePazienti(nominativi: string[]): string[] {
  const unici = [...new Set(nominativi)];
  const cognomi = unici.map(cognomePaziente);
  return unici
    .map((nom, i) => {
      const doppio = cognomi.filter((c) => c === cognomi[i]).length > 1;
      if (!doppio) return cognomi[i];
      const nome = nom.trim().slice(cognomi[i].length).trim();
      return nome ? `${cognomi[i]} ${nome[0]}.` : cognomi[i];
    })
    .sort((a, b) => a.localeCompare(b, 'it'));
}
