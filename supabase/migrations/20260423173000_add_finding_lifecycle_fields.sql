-- SecureWatch360: finding lifecycle support (lean v1.3)
-- Adds assignment + notes fields directly on findings.

alter table public.findings
  add column if not exists assigned_to_user_id uuid references auth.users (id) on delete set null,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.findings.assigned_to_user_id is
  'Optional user assignment for remediation ownership.';

comment on column public.findings.notes is
  'Simple free-text notes for triage and remediation context.';

comment on column public.findings.updated_at is
  'Last lifecycle update timestamp (status, assignment, or note changes).';

create index if not exists findings_assigned_to_user_id_idx
  on public.findings (assigned_to_user_id);

create index if not exists findings_status_updated_at_idx
  on public.findings (status, updated_at desc);
