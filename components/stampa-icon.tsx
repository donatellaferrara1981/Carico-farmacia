/* Icona Stampa (immagine). Dimensione fissa: nei pulsanti piccoli l'immagine resterebbe illeggibile. */
export function StampaIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/stampa.png" alt="" className={`w-7 h-7 shrink-0 object-contain rounded-md ${className}`} />;
}
