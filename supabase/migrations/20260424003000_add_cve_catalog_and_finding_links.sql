-- SecureWatch360: CVE catalog + finding linkage
-- Purpose:
-- 1) persist CVE metadata found by scanners
-- 2) link findings to concrete CVE records for reporting and remediation analytics

create table if not exists public.cve_catalog (
  id text primary key,
  severity text,
  description text,
  reference_url text,
  cvss_score numeric(4,1),
  source text not null default 'scanner',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cve_catalog is
  'Global CVE metadata observed by SecureWatch scanner pipelines.';

create table if not exists public.finding_cves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  cve_id text not null references public.cve_catalog (id) on delete cascade,
  scanner_source text not null default 'unknown',
  package_name text,
  installed_version text,
  created_at timestamptz not null default now(),
  constraint finding_cves_uniq unique (tenant_id, finding_id, cve_id)
);

comment on table public.finding_cves is
  'Tenant-scoped links between findings and CVEs discovered by scanners.';

create index if not exists cve_catalog_last_seen_idx
  on public.cve_catalog (last_seen_at desc);

create index if not exists finding_cves_tenant_idx
  on public.finding_cves (tenant_id);

create index if not exists finding_cves_finding_idx
  on public.finding_cves (finding_id);

create index if not exists finding_cves_cve_idx
  on public.finding_cves (cve_id);
