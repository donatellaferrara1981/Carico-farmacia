/* Icona Calendario (immagine). Accetta className come le icone lucide. */
export function CalendarioIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/calendario.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
