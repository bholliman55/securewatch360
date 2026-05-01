-- Lightweight runner telemetry for optional on-prem SecureWatch360 runners.

create table if not exists runner_heartbeats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  runner_id text not null,
  host_name text,
  version text,
  capabilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, runner_id)
);

create index if not exists runner_heartbeats_tenant_seen_idx
  on runner_heartbeats (tenant_id, last_seen_at desc);

comment on table runner_heartbeats is 'Heartbeat rows from optional SecureWatch360 runners (authenticated via SW360_RUNNER_TOKEN).';
