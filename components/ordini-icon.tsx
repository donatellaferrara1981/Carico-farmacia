/* Icona Ordini / Approvvigionamento (immagine). Accetta className come le icone lucide. */
export function OrdiniIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/ordini.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
