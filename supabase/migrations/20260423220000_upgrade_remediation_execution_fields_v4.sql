-- SecureWatch360 v4: remediation execution + approval separation
-- Adds explicit execution tracking fields while preserving existing action_status.

alter table public.remediation_actions
  add column if not exists execution_status text not null default 'pending',
  add column if not exists execution_mode text not null default 'manual',
  add column if not exists execution_payload jsonb not null default '{}',
  add column if not exists execution_result jsonb not null default '{}',
  add column if not exists executed_at timestamptz,
  add column if not exists failed_at timestamptz;

alter table public.remediation_actions
  drop constraint if exists remediation_actions_execution_status_check;

alter table public.remediation_actions
  add constraint remediation_actions_execution_status_check check (
    execution_status in ('pending', 'approved', 'queued', 'running', 'completed', 'failed', 'cancelled')
  );

alter table public.remediation_actions
  drop constraint if exists remediation_actions_execution_mode_check;

alter table public.remediation_actions
  add constraint remediation_actions_execution_mode_check check (
    execution_mode in ('manual', 'semi_automatic', 'automatic')
  );

comment on column public.remediation_actions.execution_status is
  'Execution lifecycle state separate from approval state.';

comment on column public.remediation_actions.execution_mode is
  'How execution is expected to run: manual, semi_automatic, or automatic.';

comment on column public.remediation_actions.execution_payload is
  'Execution request payload given to an operator/worker.';

comment on column public.remediation_actions.execution_result is
  'Execution result payload from operator/worker runtime.';

comment on column public.remediation_actions.executed_at is
  'Timestamp when execution completed successfully.';

comment on column public.remediation_actions.failed_at is
  'Timestamp when execution failed.';

-- Backfill execution_status from legacy action_status for existing records.
update public.remediation_actions
set execution_status = case action_status
  when 'proposed' then 'pending'
  when 'approved' then 'approved'
  when 'rejected' then 'cancelled'
  when 'in_progress' then 'running'
  when 'completed' then 'completed'
  when 'failed' then 'failed'
  when 'cancelled' then 'cancelled'
  else execution_status
end
where execution_status = 'pending';

create index if not exists remediation_actions_execution_status_idx
  on public.remediation_actions (execution_status);

create index if not exists remediation_actions_execution_mode_idx
  on public.remediation_actions (execution_mode);

create index if not exists remediation_actions_tenant_execution_status_idx
  on public.remediation_actions (tenant_id, execution_status, updated_at desc);
