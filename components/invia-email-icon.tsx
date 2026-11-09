/* Icona Invia Email (immagine). Dimensione fissa come StampaIcon. */
export function InviaEmailIcon({ className = '' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icone/invia-email.png" alt="" className={`w-7 h-7 shrink-0 object-contain rounded-md ${className}`} />;
}
