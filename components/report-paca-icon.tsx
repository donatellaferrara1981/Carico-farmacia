/* Icona Report PACA (immagine). Accetta className come le icone lucide. */
export function ReportPacaIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/report-paca.png" alt="" className={`object-contain rounded-md ${className}`} />;
}
