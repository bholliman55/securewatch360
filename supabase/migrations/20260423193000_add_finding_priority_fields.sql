-- SecureWatch360: finding prioritization fields (lean v1)
-- Stores priority score based on severity + asset type + exposure.

alter table public.findings
  add column if not exists asset_type text not null default 'unknown',
  add column if not exists exposure text not null default 'unknown',
  add column if not exists priority_score integer not null default 0;

alter table public.findings
  drop constraint if exists findings_priority_score_check;

alter table public.findings
  add constraint findings_priority_score_check
  check (priority_score >= 0 and priority_score <= 100);

comment on column public.findings.asset_type is
  'Asset class used for prioritization, e.g. webapp, cloud_account, hostname.';

comment on column public.findings.exposure is
  'Exposure level used for prioritization, e.g. internet, internal, unknown.';

comment on column public.findings.priority_score is
  'Simple 0-100 score based on severity, asset_type, and exposure.';

update public.findings
set
  asset_type = coalesce(nullif(asset_type, ''), 'unknown'),
  exposure = coalesce(nullif(exposure, ''), 'unknown'),
  priority_score = case severity
    when 'critical' then 85
    when 'high' then 70
    when 'medium' then 50
    when 'low' then 25
    else 10
  end
where priority_score = 0;

create index if not exists findings_priority_score_idx
  on public.findings (priority_score desc);

create index if not exists findings_tenant_priority_idx
  on public.findings (tenant_id, priority_score desc, created_at desc);
