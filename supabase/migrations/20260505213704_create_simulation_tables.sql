-- SecureWatch360: persisted simulator run tracking (CLI / lab executions)
-- Multi-tenant: rows are scoped to tenants; writes typically use service role.

create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scenario_id text not null,
  scenario_name text not null,
  status text not null default 'pending',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  autonomy_score integer check (autonomy_score is null or (autonomy_score >= 0 and autonomy_score <= 100)),
  passed boolean,
  created_at timestamptz not null default now(),
  constraint simulation_runs_status_check check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  )
);

comment on table public.simulation_runs is
  'One row per attack-simulation / lab run (synthetic metadata only).';

comment on column public.simulation_runs.status is
  'Lifecycle: pending | running | completed | failed | cancelled.';

comment on column public.simulation_runs.autonomy_score is
  'Overall autonomy scorecard 0–100 when the run has finished.';

create index if not exists simulation_runs_tenant_started_idx
  on public.simulation_runs (tenant_id, started_at desc);

create index if not exists simulation_runs_scenario_idx
  on public.simulation_runs (tenant_id, scenario_id);

create table if not exists public.simulation_events (
  id uuid primary key default gen_random_uuid(),
  simulation_run_id uuid not null references public.simulation_runs (id) on delete cascade,
  event_type text not null,
  agent_target text,
  payload jsonb not null default '{}'::jsonb,
  emitted_at timestamptz not null default now()
);

comment on table public.simulation_events is
  'Synthetic events emitted during a simulator run (stamped payloads, no exploits).';

create index if not exists simulation_events_run_emitted_idx
  on public.simulation_events (simulation_run_id, emitted_at desc);

create table if not exists public.simulation_agent_results (
  id uuid primary key default gen_random_uuid(),
  simulation_run_id uuid not null references public.simulation_runs (id) on delete cascade,
  agent_id text not null,
  passed boolean not null default false,
  score integer not null default 0 check (score >= 0 and score <= 100),
  failures jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint simulation_agent_results_unique_run_agent unique (simulation_run_id, agent_id)
);

comment on table public.simulation_agent_results is
  'Per-agent checklist outcome from simulator-side validators for a single run.';

create index if not exists simulation_agent_results_run_idx
  on public.simulation_agent_results (simulation_run_id);

create table if not exists public.simulation_reports (
  id uuid primary key default gen_random_uuid(),
  simulation_run_id uuid not null references public.simulation_runs (id) on delete cascade,
  report_json jsonb not null default '{}'::jsonb,
  report_markdown text,
  created_at timestamptz not null default now()
);

comment on table public.simulation_reports is
  'Human + machine SAR-style payloads generated for a run (multiple versions allowed).';

create index if not exists simulation_reports_run_created_idx
  on public.simulation_reports (simulation_run_id, created_at desc);

-- Row level security (aligns with other tenant tables in this project)
alter table public.simulation_runs enable row level security;
alter table public.simulation_events enable row level security;
alter table public.simulation_agent_results enable row level security;
alter table public.simulation_reports enable row level security;

create policy "simulation_runs_tenant_isolation" on public.simulation_runs
  for all using (tenant_id = auth.uid());

create policy "simulation_events_tenant_isolation" on public.simulation_events
  for all using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_events.simulation_run_id
        and r.tenant_id = auth.uid()
    )
  );

create policy "simulation_agent_results_tenant_isolation" on public.simulation_agent_results
  for all using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_agent_results.simulation_run_id
        and r.tenant_id = auth.uid()
    )
  );

create policy "simulation_reports_tenant_isolation" on public.simulation_reports
  for all using (
    exists (
      select 1
      from public.simulation_runs r
      where r.id = simulation_reports.simulation_run_id
        and r.tenant_id = auth.uid()
    )
  );
