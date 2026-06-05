import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUserContext } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';
import { AppHeader } from '@/components/app-header';
import { FileText } from 'lucide-react';

export const metadata = { title: 'Dashboard' };

export default async function AppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('user_id', user.id)
      .single(),
  ]);

  if (profileRes.error || memberRes.error || !memberRes.data.organizations) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <h1 className="font-display text-2xl font-semibold text-ink mb-2">
            Configurazione in corso
          </h1>
          <p className="text-ink-soft text-sm">
            Il tuo account è stato creato. Ricarica la pagina tra qualche secondo.
          </p>
        </div>
      </div>
    );
  }

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink mb-2">
          Benvenuta, {ctx.profile.full_name?.split(' ')[0]}
        </h1>
        <p className="text-ink-soft mb-8">
          Organizzazione: <strong>{ctx.organization.name}</strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(['terapie', 'nutrizioni', 'sanitario'] as const).map((cat) => (
            <Link
              key={cat}
              href={`/${cat}`}
              className="card hover:border-forest/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-forest-tint flex items-center justify-center group-hover:bg-forest/10 transition-colors">
                  <FileText className="w-5 h-5 text-forest" />
                </div>
                <h2 className="font-semibold text-ink">{CAT_LABELS[cat]}</h2>
              </div>
              <p className="text-ink-mute text-sm">Carica e gestisci documenti PDF</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
