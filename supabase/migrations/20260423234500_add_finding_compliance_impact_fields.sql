-- SecureWatch360 v4: compliance impact fields on findings
-- Purpose:
-- 1) store compliance impact level after policy/compliance hook evaluation
-- 2) preserve lightweight JSON context for explainability and future agents

alter table public.findings
  add column if not exists compliance_impact text not null default 'none',
  add column if not exists compliance_context jsonb not null default '{}'::jsonb;

alter table public.findings
  drop constraint if exists findings_compliance_impact_check;

alter table public.findings
  add constraint findings_compliance_impact_check check (
    compliance_impact in ('none', 'low', 'moderate', 'high', 'critical')
  );

comment on column public.findings.compliance_impact is
  'Compliance impact classification assigned by policy/compliance hooks.';

comment on column public.findings.compliance_context is
  'Context payload for compliance mapping and impact decisions.';

create index if not exists findings_tenant_compliance_impact_idx
  on public.findings (tenant_id, compliance_impact);
