create table if not exists integration_event_dedupes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, source, external_event_id)
);

create index if not exists integration_event_dedupes_tenant_source_idx
  on integration_event_dedupes (tenant_id, source, created_at desc);
