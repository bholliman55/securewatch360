-- SecureWatch360 v1 — core multi-tenant scan model
-- Apply with: supabase db push (or run in SQL editor)

-- ---------------------------------------------------------------------------
-- tenants
-- One row per customer / organization. All scan data hangs off this for
-- isolation and (later) RLS. Deleting a tenant removes its targets, runs, and
-- findings (defensible for offboarding; use soft-delete later if you need
-- legal retention without visible rows).
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.tenants is
  'Top-level account boundary for multi-tenancy. Every scan and finding belongs to exactly one tenant.';

comment on column public.tenants.name is
  'Human label for the tenant (shown in the UI; not a unique slug in v1).';

-- ---------------------------------------------------------------------------
-- scan_targets
-- What we scan: hostnames, URLs, IP ranges, cloud accounts, etc. Scoped to a
-- tenant. Status models enable/disable without deleting history via scan_runs
-- and findings on past runs.
-- ---------------------------------------------------------------------------
create table public.scan_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  target_name text not null,
  target_type text not null,
  target_value text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint scan_targets_status_check check (status in ('active', 'paused', 'archived'))
);

comment on table public.scan_targets is
  'A configured asset or scope the platform should evaluate (e.g. domain, URL). Tied to one tenant.';

comment on column public.scan_targets.target_type is
  'Kind of target, e.g. url, domain, ip — interpreted by scanner adapters.';

comment on column public.scan_targets.target_value is
  'The concrete value to scan (e.g. https://example.com or 10.0.0.0/8).';

comment on column public.scan_targets.status is
  'active = include in new scans; paused = skip; archived = hidden but historical runs may reference the row.';

create index scan_targets_tenant_id_idx on public.scan_targets (tenant_id);
create index scan_targets_tenant_id_status_idx on public.scan_targets (tenant_id, status);

-- ---------------------------------------------------------------------------
-- scan_runs
-- One Inngest-driven execution: started when the workflow is triggered for a
-- target, finished when the pipeline completes or fails. workflow_run_id stores
-- the Inngest run id for correlation. scan_target can be set null if the
-- target row is later removed but we want to keep the run record.
-- ---------------------------------------------------------------------------
create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scan_target_id uuid references public.scan_targets (id) on delete set null,
  workflow_run_id text not null,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint scan_runs_status_check check (
    status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  constraint scan_runs_workflow_run_id_uniq unique (workflow_run_id)
);

comment on table public.scan_runs is
  'A single end-to-end scan attempt for a target, usually one Inngest function execution graph.';

comment on column public.scan_runs.workflow_run_id is
  'Inngest (or other orchestrator) run id; unique for deduplication and support/debugging.';

comment on column public.scan_runs.started_at is
  'When the workflow actually began processing (set when moving to running or first step).';

comment on column public.scan_runs.completed_at is
  'Set when the run reaches a terminal state (succeeded, failed, cancelled).';

create index scan_runs_tenant_id_idx on public.scan_runs (tenant_id);
create index scan_runs_scan_target_id_idx on public.scan_runs (scan_target_id);
create index scan_runs_status_idx on public.scan_runs (status);
create index scan_runs_tenant_id_created_at_idx on public.scan_runs (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- findings
-- Individual issues produced by a run (many rows per run). evidence holds raw
-- scanner output for display and reprocessing. Deleting a run removes its
-- findings (CASCADE) — the run is the audit boundary in v1.
-- ---------------------------------------------------------------------------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scan_run_id uuid not null references public.scan_runs (id) on delete cascade,
  severity text not null,
  category text,
  title text not null,
  description text,
  evidence jsonb not null default '{}',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint findings_severity_check check (
    severity in ('info', 'low', 'medium', 'high', 'critical')
  ),
  constraint findings_status_check check (
    status in ('new', 'acknowledged', 'resolved', 'false_positive')
  )
);

comment on table public.findings is
  'Normalized result row from a scan: severity, free-text fields, and machine-readable evidence.';

comment on column public.findings.tenant_id is
  'Denormalized from the run for direct tenant-scoped filters and RLS; must match the parent scan_run.tenant_id when inserting.';

comment on column public.findings.evidence is
  'Opaque JSON for snippets, request/response, rule ids, and adapter-specific metadata.';

create index findings_tenant_id_idx on public.findings (tenant_id);
create index findings_scan_run_id_idx on public.findings (scan_run_id);
create index findings_tenant_id_status_idx on public.findings (tenant_id, status);
create index findings_tenant_id_severity_idx on public.findings (tenant_id, severity);
create index findings_status_idx on public.findings (status);
create index findings_severity_idx on public.findings (severity);
create index findings_scan_run_id_severity_idx on public.findings (scan_run_id, severity);
