/* Icona grafici (immagine). Accetta className come le icone lucide. */
export function GraficiIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/grafici.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
