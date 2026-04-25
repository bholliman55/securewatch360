-- SecureWatch360 v4: richer audit event envelope
-- Adds entity context and summary for explainability/forensics/compliance.

alter table public.audit_logs
  add column if not exists entity_type text not null default 'system',
  add column if not exists entity_id text not null default 'unknown',
  add column if not exists summary text not null default '';

comment on column public.audit_logs.entity_type is
  'Audited entity category, e.g. finding, remediation_action, approval_request, risk_exception.';

comment on column public.audit_logs.entity_id is
  'Primary identifier of the audited entity.';

comment on column public.audit_logs.summary is
  'Short human-readable summary for timeline/review screens.';

create index if not exists audit_logs_tenant_entity_idx
  on public.audit_logs (tenant_id, entity_type, entity_id, created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
