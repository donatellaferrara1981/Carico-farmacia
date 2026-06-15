import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
import { BackButton } from '@/components/back-button';
import { ReportPacaView } from '@/components/report-paca-view';
import type { CurrentUserContext } from '@/lib/types';
import { getUoAttivaId } from '@/lib/uo-cookie';

export const metadata = { title: 'Report PACA / DRG' };

export default async function ReportPacaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members').select('*, organizations(*)').eq('user_id', user.id).single(),
  ]);
  if (profileRes.error || memberRes.error || !memberRes.data.organizations) redirect('/app');

  const org = memberRes.data.organizations as { id: string; name: string; slug: string | null };
  const ctx: CurrentUserContext = {
    user: { id: user.id, email: user.email ?? '' },
    profile: profileRes.data,
    organization: org,
    role: memberRes.data.role,
  };

  const uoAttivaId = await getUoAttivaId();
  let uoNome: string | null = null;
  if (uoAttivaId) {
    const { data: uo } = await supabase
      .from('unita_operative').select('nome').eq('id', uoAttivaId).single();
    uoNome = uo?.nome ?? null;
  }

  // Carica pazienti con dati PACA/SDO (tutti — non solo UO attiva, per report completi)
  const query = supabase
    .from('pazienti')
    .select('id, nominativo, sala, numero_letto, codice_sdo, data_ricovero, data_dimissione, diagnosi_principale, esito_paca, importo_drg, data_chiusura_cartella, note_paca, unita_operativa_id')
    .eq('org_id', org.id)
    .order('data_chiusura_cartella', { ascending: false });
  if (uoAttivaId) query.eq('unita_operativa_id', uoAttivaId);

  const { data: pazienti } = await query;

  // Carica tutte le voci checklist per questi pazienti
  const pazIds = (pazienti ?? []).map((p) => p.id);
  const { data: checklistRaw } = pazIds.length > 0
    ? await supabase
        .from('checklist_dimissione')
        .select('id, paziente_id, voce, completata, ordine')
        .in('paziente_id', pazIds)
        .order('ordine')
    : { data: [] };

  // Raggruppa voci per paziente
  const checklistByPaziente: Record<string, { id: string; voce: string; completata: boolean }[]> = {};
  for (const v of checklistRaw ?? []) {
    if (!checklistByPaziente[v.paziente_id]) checklistByPaziente[v.paziente_id] = [];
    checklistByPaziente[v.paziente_id].push({ id: v.id, voce: v.voce, completata: v.completata });
  }

  const datiPazienti = (pazienti ?? []).map((p) => ({
    ...p,
    checklist: checklistByPaziente[p.id] ?? [],
  }));

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader ctx={ctx} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <BackButton />
          <h1 className="font-display text-3xl font-semibold text-ink mt-2">Report PACA / DRG</h1>
          <p className="text-ink-soft text-sm mt-1">
            {uoNome ? `${org.name} · ${uoNome}` : org.name} — analisi cartelle cliniche e rimborsi
          </p>
        </div>
        <ReportPacaView
          pazienti={datiPazienti}
          orgId={org.id}
          orgName={org.name}
          uoNome={uoNome}
          userName={ctx.profile.full_name ?? ''}
        />
      </main>
    </div>
  );
}
