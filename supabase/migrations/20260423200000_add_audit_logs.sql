-- SecureWatch360: audit logging foundation (lean v1)
-- Tracks security-relevant user and system actions in a consistent format.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  action text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Immutable audit events for compliance and forensic investigations.';

comment on column public.audit_logs.action is
  'Normalized action name, e.g. finding.status.updated or scan.triggered.';

comment on column public.audit_logs.payload is
  'Action-specific structured context (resource ids, before/after values, metadata).';

create index if not exists audit_logs_tenant_id_created_at_idx
  on public.audit_logs (tenant_id, created_at desc);

create index if not exists audit_logs_action_created_at_idx
  on public.audit_logs (action, created_at desc);

create index if not exists audit_logs_user_id_created_at_idx
  on public.audit_logs (user_id, created_at desc);
