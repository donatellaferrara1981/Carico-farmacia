/* Icona gare (immagine). Accetta className come le icone lucide. */
export function GareIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/gare.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
