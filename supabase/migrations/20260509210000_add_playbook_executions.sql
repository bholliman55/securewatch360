-- Playbook executions: records each time a response plan was applied to an incident.
-- This is the data store for continuous learning — the system tracks what actually
-- happened vs what the plan prescribed, accumulating institutional knowledge over time.

create table if not exists public.playbook_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_id uuid not null references public.incident_response_plans (id) on delete cascade,
  incident_id uuid references public.incidents (id) on delete set null,
  incident_title text,           -- denormalised so history survives incident deletion
  incident_severity text,
  incident_category text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text check (outcome in ('resolved', 'partially_resolved', 'escalated', 'abandoned')),
  -- Per-step outcomes: array of { step, completed, actual_hours, skipped, notes }
  step_outcomes jsonb not null default '[]'::jsonb,
  lessons_learned text,
  -- Derived signals updated on save for fast aggregation without re-scanning
  actual_duration_hours numeric generated always as (
    case
      when completed_at is not null
      then extract(epoch from (completed_at - started_at)) / 3600.0
      else null
    end
  ) stored,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.playbook_executions is
  'Each row is one time a response plan was executed for an incident. Accumulates '
  'institutional knowledge for continuous improvement.';

-- Aggregated improvement suggestions derived from executions.
-- Populated by a background job or on-demand recompute.
create table if not exists public.playbook_insights (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_id uuid not null references public.incident_response_plans (id) on delete cascade,
  insight_type text not null
    check (insight_type in ('step_over_sla', 'step_often_skipped', 'step_missing', 'plan_effective', 'plan_needs_review')),
  step_name text,
  detail text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  times_observed integer not null default 1,
  generated_at timestamptz not null default now(),
  -- Insights expire after 90 days and are regenerated on next execution
  expires_at timestamptz not null default (now() + interval '90 days')
);

comment on table public.playbook_insights is
  'Auto-generated improvement suggestions derived from playbook execution history.';

create index if not exists playbook_executions_tenant_idx on public.playbook_executions (tenant_id);
create index if not exists playbook_executions_plan_idx on public.playbook_executions (plan_id);
create index if not exists playbook_executions_incident_idx on public.playbook_executions (incident_id);
create index if not exists playbook_insights_plan_idx on public.playbook_insights (plan_id);

alter table public.playbook_executions enable row level security;
alter table public.playbook_insights enable row level security;

create policy "tenant_isolation_playbook_executions"
  on public.playbook_executions for all
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()));

create policy "tenant_isolation_playbook_insights"
  on public.playbook_insights for all
  using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()));

create policy "service_role_playbook_executions"
  on public.playbook_executions for all to service_role using (true) with check (true);

create policy "service_role_playbook_insights"
  on public.playbook_insights for all to service_role using (true) with check (true);
