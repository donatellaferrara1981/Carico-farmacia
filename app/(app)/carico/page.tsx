import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { getUoAttivaId } from '@/lib/uo-cookie';
import type { CurrentUserContext } from '@/lib/types';
import { FileUp } from 'lucide-react';

export const metadata = { title: 'Carico farmacia' };

const SEZIONI = [
  { href: '/terapie',    img: '/icone/terapie.png',    label: 'Terapie',    sub: 'Farmaci, antibiotici, nominative' },
  { href: '/nutrizioni', img: '/icone/nutrizioni.png', label: 'Nutrizioni', sub: 'Nutrizione enterale e parenterale' },
] as const;

export default async function CaricoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes, uoAttivaId] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
    getUoAttivaId(),
  ]);
  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');
  if (!uoAttivaId) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const { data: unita } = await supabase.from('unita_operative').select('*').eq('org_id', org.id).order('nome');
  const uoAttiva = (unita ?? []).find((u: { id: string }) => u.id === uoAttivaId) ?? null;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} uoAttiva={uoAttiva} unita={unita ?? []} />
      <main className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <BackButton />
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icone/carico.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-ink leading-tight">Carico farmacia</h1>
              {uoAttiva && <p className="text-xs text-ink-mute truncate">{uoAttiva.nome}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SEZIONI.map(({ href, img, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center text-center gap-2 p-4 rounded-2xl border border-line bg-bg-card hover:border-forest/40 hover:bg-forest/5 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl group-hover:scale-105 transition-transform" />
              <span className="font-semibold text-ink">{label}</span>
              <span className="text-xs text-ink-mute">{sub}</span>
            </Link>
          ))}
        </div>

        {/* Flag: carica intero consumo giornaliero (file unico terapie + nutrizioni) */}
        <Link
          href="/carico/consumo"
          className="group mt-3 flex items-center gap-3 p-4 rounded-2xl border border-forest/30 bg-forest/5 hover:bg-forest/10 hover:border-forest/50 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-forest/10 flex items-center justify-center shrink-0">
            <FileUp className="w-6 h-6 text-forest" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink">Carica intero consumo giornaliero</p>
            <p className="text-xs text-ink-mute">Carica il file e ottieni il calcolo per forma farmaceutica, pazienti e richieste</p>
          </div>
        </Link>
      </main>
    </div>
  );
}
