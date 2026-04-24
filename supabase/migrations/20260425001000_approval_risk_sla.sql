-- v4.1: SLA and escalation fields for human-gated workflows
-- Drives due dates on create and breach detection via scheduled worker.

alter table public.approval_requests
  add column if not exists sla_due_at timestamptz,
  add column if not exists sla_first_reminder_at timestamptz,
  add column if not exists sla_breached_at timestamptz,
  add column if not exists escalation_level int not null default 0;

comment on column public.approval_requests.sla_due_at is
  'When the request should be actioned; created from tenant/env SLA defaults.';

comment on column public.approval_requests.sla_breached_at is
  'Set when the approval remained pending past sla_due_at.';

comment on column public.approval_requests.escalation_level is
  'Increments when SLA is breached; future use for owner routing.';

alter table public.risk_exceptions
  add column if not exists review_sla_due_at timestamptz,
  add column if not exists sla_breached_at timestamptz,
  add column if not exists escalation_level int not null default 0;

comment on column public.risk_exceptions.review_sla_due_at is
  'Review deadline for requested exceptions (independent of expires_at on the risk itself).';

create index if not exists approval_requests_sla_pending_idx
  on public.approval_requests (status, sla_due_at)
  where status = 'pending';

create index if not exists risk_exceptions_sla_requested_idx
  on public.risk_exceptions (status, review_sla_due_at)
  where status = 'requested';
