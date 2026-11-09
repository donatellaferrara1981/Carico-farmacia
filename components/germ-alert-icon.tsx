/* Icona Germ Alert (immagine). Accetta className come le icone lucide. */
export function GermAlertIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/germ-alert.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
