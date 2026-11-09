/* Icona carrello di emergenza (immagine). Accetta className come le icone lucide. */
export function CarrelloIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/carrelli-v2.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
