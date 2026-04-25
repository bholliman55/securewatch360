-- SecureWatch360 v4: decisioning fields on findings + remediation actions
-- Adds light policy-evaluation context before full OPA integration.

alter table public.findings
  add column if not exists decision_input jsonb not null default '{}',
  add column if not exists decision_result jsonb not null default '{}',
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists exception_status text not null default 'none';

alter table public.findings
  drop constraint if exists findings_approval_status_check;

alter table public.findings
  add constraint findings_approval_status_check check (
    approval_status in ('not_required', 'pending', 'approved', 'rejected')
  );

alter table public.findings
  drop constraint if exists findings_exception_status_check;

alter table public.findings
  add constraint findings_exception_status_check check (
    exception_status in ('none', 'requested', 'approved', 'denied', 'expired')
  );

comment on column public.findings.decision_input is
  'Snapshot of policy evaluation input used during triage/remediation decisions.';

comment on column public.findings.decision_result is
  'Snapshot of policy evaluation output (allow/deny/approval/etc).';

comment on column public.findings.approval_status is
  'Approval lifecycle status for policy-governed finding actions.';

comment on column public.findings.exception_status is
  'Exception lifecycle status (risk acceptance / temporary bypass handling).';

create index if not exists findings_tenant_approval_status_idx
  on public.findings (tenant_id, approval_status);

create index if not exists findings_tenant_exception_status_idx
  on public.findings (tenant_id, exception_status);

alter table public.remediation_actions
  add column if not exists decision_input jsonb not null default '{}',
  add column if not exists decision_result jsonb not null default '{}',
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists exception_status text not null default 'none';

alter table public.remediation_actions
  drop constraint if exists remediation_actions_approval_status_check;

alter table public.remediation_actions
  add constraint remediation_actions_approval_status_check check (
    approval_status in ('not_required', 'pending', 'approved', 'rejected')
  );

alter table public.remediation_actions
  drop constraint if exists remediation_actions_exception_status_check;

alter table public.remediation_actions
  add constraint remediation_actions_exception_status_check check (
    exception_status in ('none', 'requested', 'approved', 'denied', 'expired')
  );

comment on column public.remediation_actions.decision_input is
  'Policy decision input captured when remediation action is proposed or updated.';

comment on column public.remediation_actions.decision_result is
  'Policy decision output captured for remediation orchestration/auditing.';

comment on column public.remediation_actions.approval_status is
  'Approval lifecycle status for remediation actions.';

comment on column public.remediation_actions.exception_status is
  'Exception lifecycle for remediation bypass/risk acceptance paths.';

create index if not exists remediation_actions_tenant_approval_status_idx
  on public.remediation_actions (tenant_id, approval_status);

create index if not exists remediation_actions_tenant_exception_status_idx
  on public.remediation_actions (tenant_id, exception_status);
