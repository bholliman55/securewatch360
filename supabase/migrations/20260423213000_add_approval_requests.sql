-- SecureWatch360 v4: human approval workflow records
-- Supports approvals for findings, remediation actions, and future decision domains.

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finding_id uuid references public.findings (id) on delete set null,
  remediation_action_id uuid references public.remediation_actions (id) on delete set null,
  requested_by_user_id uuid references auth.users (id) on delete set null,
  assigned_approver_user_id uuid references auth.users (id) on delete set null,
  approval_type text not null,
  status text not null default 'pending',
  reason text,
  request_payload jsonb not null default '{}',
  response_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint approval_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')
  ),
  constraint approval_requests_reference_check check (
    finding_id is not null or remediation_action_id is not null
  )
);

comment on table public.approval_requests is
  'Human-in-the-loop approval queue for security-sensitive decisions.';

comment on column public.approval_requests.approval_type is
  'Approval domain classifier, e.g. remediation_execution, risk_acceptance, exception_request.';

comment on column public.approval_requests.request_payload is
  'Structured request context shown to approvers and preserved for audit evidence.';

comment on column public.approval_requests.response_payload is
  'Structured approver response context (decision data, notes, metadata).';

comment on column public.approval_requests.resolved_at is
  'Set when request reaches terminal status (approved/rejected/cancelled/expired).';

create index if not exists approval_requests_tenant_id_idx
  on public.approval_requests (tenant_id);

create index if not exists approval_requests_status_idx
  on public.approval_requests (status);

create index if not exists approval_requests_assigned_approver_idx
  on public.approval_requests (assigned_approver_user_id);

create index if not exists approval_requests_tenant_status_idx
  on public.approval_requests (tenant_id, status, created_at desc);
