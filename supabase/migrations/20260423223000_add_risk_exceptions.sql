-- SecureWatch360 v4: risk exception (risk acceptance) records
-- Tracks request/approval lifecycle for accepting risk on findings.

create table if not exists public.risk_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  requested_by_user_id uuid references auth.users (id) on delete set null,
  approved_by_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'requested',
  justification text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_exceptions_status_check check (
    status in ('requested', 'approved', 'rejected', 'expired', 'revoked')
  )
);

comment on table public.risk_exceptions is
  'Approval records for time-bounded or permanent risk acceptance exceptions on findings.';

comment on column public.risk_exceptions.justification is
  'Business or technical rationale for accepting risk instead of immediate remediation.';

comment on column public.risk_exceptions.expires_at is
  'Optional expiration for temporary exceptions; null means no explicit expiry.';

create index if not exists risk_exceptions_tenant_id_idx
  on public.risk_exceptions (tenant_id);

create index if not exists risk_exceptions_finding_id_idx
  on public.risk_exceptions (finding_id);

create index if not exists risk_exceptions_status_idx
  on public.risk_exceptions (status);

create index if not exists risk_exceptions_tenant_status_idx
  on public.risk_exceptions (tenant_id, status, created_at desc);

create index if not exists risk_exceptions_expires_at_idx
  on public.risk_exceptions (expires_at);
