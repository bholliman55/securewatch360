-- CISA KEV, EPSS, and derived tier for triage and reporting

alter table public.cve_catalog
  add column if not exists kev_cisa boolean not null default false,
  add column if not exists epss_score numeric(5,4),
  add column if not exists epss_percentile numeric(6,3),
  add column if not exists enriched_at timestamptz,
  add column if not exists priority_tier int;

comment on column public.cve_catalog.priority_tier is
  'Lower is worse (1=KEV, higher tiers from EPSS and defaults).';

create index if not exists cve_catalog_priority_tier_idx
  on public.cve_catalog (priority_tier asc nulls last);

create index if not exists cve_catalog_enriched_at_idx
  on public.cve_catalog (enriched_at desc nulls last);
