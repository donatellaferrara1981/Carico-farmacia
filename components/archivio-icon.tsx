/* Icona Archivio (immagine). Accetta className come le icone lucide. */
export function ArchivioIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/archivio.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
