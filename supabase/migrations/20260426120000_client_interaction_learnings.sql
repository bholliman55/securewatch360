-- SecureWatch360: client interaction learning loop
-- Captures what we learn from tenant interactions for product triage, release planning, and continuous improvement.

create table if not exists public.client_interaction_learnings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source text not null,
  interaction_kind text not null,
  title text not null,
  body text not null default '',
  structured_signals jsonb not null default '{}'::jsonb,
  impact text not null default 'medium',
  product_area text,
  target_release text,
  triage_status text not null default 'new',
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid,
  shipped_in_version text,
  release_notes_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_interaction_learnings_impact_chk
    check (impact in ('low', 'medium', 'high')),
  constraint client_interaction_learnings_triage_chk
    check (triage_status in ('new', 'reviewed', 'planned', 'in_progress', 'shipped', 'wontfix')),
  constraint client_interaction_learnings_source_len check (char_length(source) <= 64),
  constraint client_interaction_learnings_kind_len check (char_length(interaction_kind) <= 64)
);

comment on table public.client_interaction_learnings is
  'Structured learnings from client interactions: triage → planned → shipped, for continuous product improvement.';

create index if not exists client_interaction_learnings_tenant_idx
  on public.client_interaction_learnings (tenant_id);

create index if not exists client_interaction_learnings_triage_idx
  on public.client_interaction_learnings (triage_status, created_at desc);

create index if not exists client_interaction_learnings_release_idx
  on public.client_interaction_learnings (target_release)
  where target_release is not null and triage_status <> 'shipped';

-- Keep updated_at fresh on change (idempotent)
create or replace function public.set_client_interaction_learnings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_client_interaction_learnings_updated on public.client_interaction_learnings;

create trigger trg_client_interaction_learnings_updated
  before update on public.client_interaction_learnings
  for each row
  execute procedure public.set_client_interaction_learnings_updated_at();
