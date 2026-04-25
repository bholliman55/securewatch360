-- Daily (or on-demand) rollup of compliance posture per tenant and framework scope.
-- Populated by Inngest `compliance-posture-daily` and readable via GET /api/compliance/posture?includeStored=true

create table if not exists public.tenant_compliance_posture (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  framework_code text not null,
  snapshot_date date not null,
  computed_at timestamptz not null default now(),
  total_controls integer not null default 0,
  controls_pass integer not null default 0,
  controls_fail integer not null default 0,
  open_mapping_links integer not null default 0,
  distinct_open_mapped_findings integer not null default 0,
  total_mapping_links integer not null default 0,
  detail jsonb not null default '{}'::jsonb
);

comment on table public.tenant_compliance_posture is
  'Point-in-time compliance posture metrics per tenant; framework_code __ALL__ means all frameworks.';

create unique index if not exists tenant_compliance_posture_tenant_fw_day_uq
  on public.tenant_compliance_posture (tenant_id, framework_code, snapshot_date);

create index if not exists tenant_compliance_posture_tenant_fw_computed_idx
  on public.tenant_compliance_posture (tenant_id, framework_code, computed_at desc);
