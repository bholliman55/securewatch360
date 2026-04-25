-- SecureWatch360: remediation action tracking (lean v1 foundation)
-- Purpose: track human or automated actions taken for findings.

create table if not exists public.remediation_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  action_type text not null,
  action_status text not null default 'proposed',
  assigned_to_user_id uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint remediation_actions_type_check check (
    action_type in ('notify', 'ticket', 'manual_fix', 'auto_fix', 'config_change', 'isolate')
  ),
  constraint remediation_actions_status_check check (
    action_status in ('proposed', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled')
  )
);

comment on table public.remediation_actions is
  'Tracks remediation work items linked to findings. Supports human approval and automated remediation paths.';

comment on column public.remediation_actions.finding_id is
  'Finding this remediation action is addressing.';

comment on column public.remediation_actions.action_type is
  'What kind of remediation this is (ticket, manual fix, auto fix, etc.).';

comment on column public.remediation_actions.action_status is
  'Lifecycle of a remediation action from proposal to completion/failure.';

comment on column public.remediation_actions.assigned_to_user_id is
  'Optional assignee for human-driven remediation tasks.';

create index if not exists remediation_actions_tenant_id_idx
  on public.remediation_actions (tenant_id);

create index if not exists remediation_actions_finding_id_idx
  on public.remediation_actions (finding_id);

create index if not exists remediation_actions_status_idx
  on public.remediation_actions (action_status);

create index if not exists remediation_actions_assigned_user_idx
  on public.remediation_actions (assigned_to_user_id);
