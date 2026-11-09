-- Archivio delle relazioni generate (Report ICA, Report PACA/DRG, antibiotici e altre relazioni).
-- Tabella aggiuntiva: non modifica nessuna tabella esistente.
-- Stesse regole di accesso di ica_esami (solo membri dell'organizzazione).

create table if not exists public.relazioni_archiviate (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null check (tipo in ('ica', 'paca', 'antibiotici', 'altro')),
  titolo text not null,
  periodo text,
  html text not null,
  created_by uuid references auth.users(id),
  created_by_nome text,
  created_at timestamptz not null default now()
);

create index if not exists relazioni_archiviate_org_tipo_idx
  on public.relazioni_archiviate (org_id, tipo, created_at desc);

alter table public.relazioni_archiviate enable row level security;

drop policy if exists "org members can manage relazioni_archiviate" on public.relazioni_archiviate;
create policy "org members can manage relazioni_archiviate"
  on public.relazioni_archiviate
  for all
  using (
    org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  )
  with check (
    org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );
