-- SecureWatch360: first compliance-ready evidence model (lean v1)
-- Generic evidence store usable across SOC 2, NIST, CMMC, HIPAA, etc.

create table if not exists public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scan_run_id uuid references public.scan_runs (id) on delete set null,
  finding_id uuid references public.findings (id) on delete set null,
  control_framework text not null,
  control_id text not null,
  evidence_type text not null,
  title text not null,
  description text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.evidence_records is
  'Generic evidence ledger for compliance controls. Can point to scan runs/findings or stand alone for policy/procedure evidence.';

comment on column public.evidence_records.control_framework is
  'Framework family, e.g. soc2, nist_800_171, cmmc, hipaa.';

comment on column public.evidence_records.control_id is
  'Control reference within the framework, e.g. CC6.1, AC.L2-3.1.1.';

comment on column public.evidence_records.evidence_type is
  'Evidence category, e.g. scan_result, config_snapshot, policy_doc, access_review.';

comment on column public.evidence_records.payload is
  'Structured evidence body (JSON) for machine use and future audit exports.';

-- Useful query patterns
create index if not exists evidence_records_tenant_id_idx
  on public.evidence_records (tenant_id);

create index if not exists evidence_records_framework_control_idx
  on public.evidence_records (control_framework, control_id);

create index if not exists evidence_records_scan_run_id_idx
  on public.evidence_records (scan_run_id);

create index if not exists evidence_records_finding_id_idx
  on public.evidence_records (finding_id);

create index if not exists evidence_records_created_at_idx
  on public.evidence_records (created_at desc);
