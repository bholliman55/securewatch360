-- SecureWatch360: investor demo persistence tables.
--
-- Backs `src/demo/investorMode/demoRepository.ts`. Every row in these
-- tables is fictional, fabricated demo data — never linked to a real
-- tenant. We deliberately do NOT add a `tenant_id` column to scope these
-- tables to `tenants(id)`; the data is global demo state shared by every
-- investor session, and `scenario_key` partitions per-scenario rows.
--
-- Tables:
--   demo_scenarios       — registry of available demo scenarios (one row per scenario_key)
--   demo_clients         — synthetic MSP customers (e.g. "Acme Dental")
--   demo_assets          — synthetic critical assets (e.g. "ACME-FS01")
--   demo_events          — canonical timeline events (replay engine source of truth)
--   demo_agent_reasoning — per-event AI agent reasoning notes used by the UI
--   demo_actions         — high-level actions taken in the scenario (isolate, ticket, etc.)
--   demo_reports         — generated executive + business-impact reports
--   demo_metrics         — flattened display metrics for the demo dashboard

-- ---------------------------------------------------------------------------
-- demo_scenarios
-- ---------------------------------------------------------------------------

create table if not exists public.demo_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null unique,
  name text not null,
  description text null,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_scenarios_status_check check (
    status in ('ready', 'running', 'completed', 'archived')
  )
);

comment on table public.demo_scenarios is
  'Registry of investor-demo scenarios. scenario_key is the stable string used by every other demo_* table.';

create index if not exists demo_scenarios_scenario_key_idx
  on public.demo_scenarios (scenario_key);

create index if not exists demo_scenarios_status_idx
  on public.demo_scenarios (status);

create index if not exists demo_scenarios_created_at_idx
  on public.demo_scenarios (created_at desc);

-- Keep `updated_at` accurate on every row mutation.
create or replace function public.demo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists demo_scenarios_set_updated_at on public.demo_scenarios;
create trigger demo_scenarios_set_updated_at
  before update on public.demo_scenarios
  for each row execute function public.demo_set_updated_at();

-- ---------------------------------------------------------------------------
-- demo_clients
-- ---------------------------------------------------------------------------

create table if not exists public.demo_clients (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  client_name text not null,
  industry text null,
  employee_count int null,
  msp_name text null,
  compliance_frameworks text[] null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.demo_clients is
  'Synthetic MSP customers attached to a demo scenario. All values fictional.';

create index if not exists demo_clients_scenario_key_idx
  on public.demo_clients (scenario_key);

create index if not exists demo_clients_created_at_idx
  on public.demo_clients (created_at desc);

-- ---------------------------------------------------------------------------
-- demo_assets
-- ---------------------------------------------------------------------------

create table if not exists public.demo_assets (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  client_name text not null,
  asset_name text not null,
  asset_type text not null,
  risk_level text not null,
  status text not null default 'healthy',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint demo_assets_risk_level_check check (
    risk_level in ('low', 'medium', 'high', 'critical')
  ),
  constraint demo_assets_status_check check (
    status in ('healthy', 'at_risk', 'compromised', 'isolated', 'remediated')
  )
);

comment on table public.demo_assets is
  'Synthetic critical assets that the demo timeline acts on (file servers, endpoints, etc.).';

create index if not exists demo_assets_scenario_key_idx
  on public.demo_assets (scenario_key);

create index if not exists demo_assets_status_idx
  on public.demo_assets (status);

create index if not exists demo_assets_created_at_idx
  on public.demo_assets (created_at desc);

-- ---------------------------------------------------------------------------
-- demo_events
-- ---------------------------------------------------------------------------

create table if not exists public.demo_events (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  event_order int not null,
  offset_seconds int not null,
  event_type text not null,
  severity text not null,
  title text not null,
  description text not null,
  agent_name text null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  emitted_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint demo_events_severity_check check (
    severity in ('info', 'low', 'medium', 'high', 'critical')
  ),
  constraint demo_events_status_check check (
    status in ('pending', 'emitted', 'skipped')
  ),
  constraint demo_events_offset_seconds_check check (offset_seconds >= 0),
  constraint demo_events_unique_order_per_scenario unique (scenario_key, event_order)
);

comment on table public.demo_events is
  'Canonical timeline events for a scenario — replay engine source of truth when present.';

create index if not exists demo_events_scenario_key_idx
  on public.demo_events (scenario_key);

create index if not exists demo_events_event_type_idx
  on public.demo_events (event_type);

create index if not exists demo_events_status_idx
  on public.demo_events (status);

create index if not exists demo_events_event_order_idx
  on public.demo_events (event_order);

create index if not exists demo_events_created_at_idx
  on public.demo_events (created_at desc);

create index if not exists demo_events_scenario_order_idx
  on public.demo_events (scenario_key, event_order);

-- ---------------------------------------------------------------------------
-- demo_agent_reasoning
-- ---------------------------------------------------------------------------

create table if not exists public.demo_agent_reasoning (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  event_type text not null,
  agent_name text not null,
  reasoning_summary text not null,
  confidence numeric null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint demo_agent_reasoning_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

comment on table public.demo_agent_reasoning is
  'Per-event AI agent reasoning summaries displayed alongside the timeline (Agent 2/3/5).';

create index if not exists demo_agent_reasoning_scenario_key_idx
  on public.demo_agent_reasoning (scenario_key);

create index if not exists demo_agent_reasoning_event_type_idx
  on public.demo_agent_reasoning (event_type);

create index if not exists demo_agent_reasoning_created_at_idx
  on public.demo_agent_reasoning (created_at desc);

-- ---------------------------------------------------------------------------
-- demo_actions
-- ---------------------------------------------------------------------------

create table if not exists public.demo_actions (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  action_type text not null,
  action_label text not null,
  safety_level text not null,
  requires_confirmation boolean not null default false,
  confirmed boolean not null default false,
  status text not null default 'pending',
  result_summary text null,
  created_at timestamptz not null default now(),
  executed_at timestamptz null,
  constraint demo_actions_safety_level_check check (
    safety_level in ('READ_ONLY', 'LOW_RISK_ACTION', 'HIGH_RISK_ACTION', 'DESTRUCTIVE_ACTION')
  ),
  constraint demo_actions_status_check check (
    status in ('pending', 'awaiting_confirmation', 'confirmed', 'executed', 'failed', 'cancelled')
  )
);

comment on table public.demo_actions is
  'High-level actions the scenario takes (isolate endpoint, create ticket, etc.). Demo-only — never executes against real infrastructure.';

create index if not exists demo_actions_scenario_key_idx
  on public.demo_actions (scenario_key);

create index if not exists demo_actions_status_idx
  on public.demo_actions (status);

create index if not exists demo_actions_created_at_idx
  on public.demo_actions (created_at desc);

-- ---------------------------------------------------------------------------
-- demo_reports
-- ---------------------------------------------------------------------------

create table if not exists public.demo_reports (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  report_type text not null,
  title text not null,
  summary text not null,
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint demo_reports_report_type_check check (
    report_type in ('executive', 'business_impact', 'technical', 'compliance')
  )
);

comment on table public.demo_reports is
  'Generated executive + business-impact reports for the demo dashboard.';

create index if not exists demo_reports_scenario_key_idx
  on public.demo_reports (scenario_key);

create index if not exists demo_reports_created_at_idx
  on public.demo_reports (created_at desc);

-- ---------------------------------------------------------------------------
-- demo_metrics
-- ---------------------------------------------------------------------------

create table if not exists public.demo_metrics (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  metric_key text not null,
  metric_label text not null,
  metric_value text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint demo_metrics_unique_key_per_scenario unique (scenario_key, metric_key)
);

comment on table public.demo_metrics is
  'Flattened display metrics for the demo dashboard (Time to detect, Time to contain, …).';

create index if not exists demo_metrics_scenario_key_idx
  on public.demo_metrics (scenario_key);

create index if not exists demo_metrics_sort_order_idx
  on public.demo_metrics (sort_order);

create index if not exists demo_metrics_created_at_idx
  on public.demo_metrics (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Demo tables are intentionally global (no tenant_id column). Every record
-- is fabricated investor-demo data, so the policy surface is simple:
--   - any signed-in user can SELECT
--   - any signed-in user can INSERT / UPDATE / DELETE
--   - anonymous role has no access
-- Service-role writes (the repository running server-side) bypass RLS the
-- same way they do for every other table in this schema.

alter table public.demo_scenarios enable row level security;
alter table public.demo_clients enable row level security;
alter table public.demo_assets enable row level security;
alter table public.demo_events enable row level security;
alter table public.demo_agent_reasoning enable row level security;
alter table public.demo_actions enable row level security;
alter table public.demo_reports enable row level security;
alter table public.demo_metrics enable row level security;

-- Helper: same four policies on each table (select / insert / update / delete).
-- Kept inline rather than as a function so each policy shows up in supabase
-- dashboard and `pg_dump` audits without indirection.

-- demo_scenarios -----------------------------------------------------------

create policy "demo_scenarios_select"
  on public.demo_scenarios for select to authenticated using (true);
create policy "demo_scenarios_insert"
  on public.demo_scenarios for insert to authenticated with check (true);
create policy "demo_scenarios_update"
  on public.demo_scenarios for update to authenticated using (true) with check (true);
create policy "demo_scenarios_delete"
  on public.demo_scenarios for delete to authenticated using (true);

-- demo_clients -------------------------------------------------------------

create policy "demo_clients_select"
  on public.demo_clients for select to authenticated using (true);
create policy "demo_clients_insert"
  on public.demo_clients for insert to authenticated with check (true);
create policy "demo_clients_update"
  on public.demo_clients for update to authenticated using (true) with check (true);
create policy "demo_clients_delete"
  on public.demo_clients for delete to authenticated using (true);

-- demo_assets --------------------------------------------------------------

create policy "demo_assets_select"
  on public.demo_assets for select to authenticated using (true);
create policy "demo_assets_insert"
  on public.demo_assets for insert to authenticated with check (true);
create policy "demo_assets_update"
  on public.demo_assets for update to authenticated using (true) with check (true);
create policy "demo_assets_delete"
  on public.demo_assets for delete to authenticated using (true);

-- demo_events --------------------------------------------------------------

create policy "demo_events_select"
  on public.demo_events for select to authenticated using (true);
create policy "demo_events_insert"
  on public.demo_events for insert to authenticated with check (true);
create policy "demo_events_update"
  on public.demo_events for update to authenticated using (true) with check (true);
create policy "demo_events_delete"
  on public.demo_events for delete to authenticated using (true);

-- demo_agent_reasoning -----------------------------------------------------

create policy "demo_agent_reasoning_select"
  on public.demo_agent_reasoning for select to authenticated using (true);
create policy "demo_agent_reasoning_insert"
  on public.demo_agent_reasoning for insert to authenticated with check (true);
create policy "demo_agent_reasoning_update"
  on public.demo_agent_reasoning for update to authenticated using (true) with check (true);
create policy "demo_agent_reasoning_delete"
  on public.demo_agent_reasoning for delete to authenticated using (true);

-- demo_actions -------------------------------------------------------------

create policy "demo_actions_select"
  on public.demo_actions for select to authenticated using (true);
create policy "demo_actions_insert"
  on public.demo_actions for insert to authenticated with check (true);
create policy "demo_actions_update"
  on public.demo_actions for update to authenticated using (true) with check (true);
create policy "demo_actions_delete"
  on public.demo_actions for delete to authenticated using (true);

-- demo_reports -------------------------------------------------------------

create policy "demo_reports_select"
  on public.demo_reports for select to authenticated using (true);
create policy "demo_reports_insert"
  on public.demo_reports for insert to authenticated with check (true);
create policy "demo_reports_update"
  on public.demo_reports for update to authenticated using (true) with check (true);
create policy "demo_reports_delete"
  on public.demo_reports for delete to authenticated using (true);

-- demo_metrics -------------------------------------------------------------

create policy "demo_metrics_select"
  on public.demo_metrics for select to authenticated using (true);
create policy "demo_metrics_insert"
  on public.demo_metrics for insert to authenticated with check (true);
create policy "demo_metrics_update"
  on public.demo_metrics for update to authenticated using (true) with check (true);
create policy "demo_metrics_delete"
  on public.demo_metrics for delete to authenticated using (true);
