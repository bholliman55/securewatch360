-- SecureWatch360: scheduled scan configuration (lean v1)
-- Supports daily/weekly cadence, either per tenant (all active targets)
-- or per target (single target schedule).

create table if not exists public.scan_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scan_target_id uuid references public.scan_targets (id) on delete cascade,
  scope text not null default 'target',
  frequency text not null,
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scan_schedules_scope_check check (scope in ('tenant', 'target')),
  constraint scan_schedules_frequency_check check (frequency in ('daily', 'weekly')),
  constraint scan_schedules_scope_target_consistency check (
    (scope = 'tenant' and scan_target_id is null) or
    (scope = 'target' and scan_target_id is not null)
  )
);

comment on table public.scan_schedules is
  'Defines automatic scan cadence per tenant or target.';

comment on column public.scan_schedules.scope is
  'tenant = all active targets in tenant; target = one specific scan target.';

comment on column public.scan_schedules.frequency is
  'Current supported frequencies: daily, weekly.';

create index if not exists scan_schedules_tenant_id_idx
  on public.scan_schedules (tenant_id);

create index if not exists scan_schedules_frequency_enabled_idx
  on public.scan_schedules (frequency, enabled);

create unique index if not exists scan_schedules_unique_scope_idx
  on public.scan_schedules (
    tenant_id,
    scope,
    coalesce(scan_target_id, '00000000-0000-0000-0000-000000000000'::uuid),
    frequency
  );
