import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { DocumentiList } from '@/components/documenti-list';
import { UploadButton } from '@/components/upload-button';
import type { CurrentUserContext, CategoriaArticolo } from '@/lib/types';
import { CAT_LABELS } from '@/lib/types';

const VALIDE: CategoriaArticolo[] = ['terapie', 'nutrizioni', 'sanitario'];

export async function generateMetadata({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  return { title: CAT_LABELS[categoria as CategoriaArticolo] ?? categoria };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;

  if (!VALIDE.includes(categoria as CategoriaArticolo)) notFound();
  const cat = categoria as CategoriaArticolo;

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

  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const { data: documenti } = await supabase
    .from('documenti')
    .select('*')
    .eq('org_id', org.id)
    .eq('categoria', cat)
    .order('created_at', { ascending: false });

  const canUpload = ctx.role === 'admin' || ctx.role === 'collaboratore';

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink capitalize">
              {CAT_LABELS[cat]}
            </h1>
            <p className="text-ink-soft text-sm mt-1">{org.name}</p>
          </div>
          {canUpload && <UploadButton categoria={cat} orgId={org.id} />}
        </div>

        <DocumentiList
          documenti={documenti ?? []}
          orgId={org.id}
          categoria={cat}
          canDelete={canUpload}
        />
      </main>
    </div>
  );
}
