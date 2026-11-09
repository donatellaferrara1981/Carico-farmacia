'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Logo } from '@/components/logo';
import { AVATAR_IDS, avatarSrc } from '@/lib/avatar';
import { salvaAvatarAction } from '@/app/(app)/avatar-actions';

/* Logo "Gestionale Infermieristico" con l'avatar scelto dall'account.
   Toccando l'icona si apre la scelta dell'avatar; il testo porta alla home. */
export function LogoAvatar({ avatar }: { avatar?: string | null }) {
  const [open, setOpen] = useState(false);
  const [scelto, setScelto] = useState<string | null>(avatar ?? null);
  const [pending, start] = useTransition();
  const src = avatarSrc(scelto);

  function scegli(id: string | null) {
    setScelto(id);
    setOpen(false);
    start(async () => { await salvaAvatarAction(id); });
  }

  return (
    <div className="relative flex items-center gap-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Scegli avatar account" title="Scegli il tuo avatar"
        className={`shrink-0 rounded-xl active:scale-95 transition ${pending ? 'opacity-60' : ''}`}>
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" className="w-10 h-10 rounded-xl object-cover" />
          : <Logo size={36} hideText />}
      </button>
      <Link href="/app" className="font-display font-semibold text-forest text-base leading-tight">
        Gestionale<br />Infermieristico
      </Link>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-[19rem] max-w-[90vw] rounded-2xl border border-line bg-bg-card shadow-lg p-3">
            <p className="text-xs font-semibold text-ink-soft mb-2">Scegli il tuo avatar</p>
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_IDS.map((id) => (
                <button key={id} type="button" onClick={() => scegli(id)}
                  className={`relative rounded-xl overflow-hidden border-2 ${scelto === id ? 'border-forest' : 'border-transparent hover:border-forest/40'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/avatar/${id}.png`} alt="" className="w-full aspect-square object-cover" />
                  {scelto === id && <span className="absolute top-1 right-1 bg-forest text-white rounded-full p-0.5"><Check className="w-3 h-3" /></span>}
                </button>
              ))}
              <button type="button" onClick={() => scegli(null)}
                className="rounded-xl border-2 border-dashed border-line text-[11px] text-ink-mute flex flex-col items-center justify-center gap-1 aspect-square hover:border-forest/40">
                <Logo size={28} hideText />
                Predefinita
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
