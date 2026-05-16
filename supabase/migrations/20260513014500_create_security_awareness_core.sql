create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.awareness_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid null,
  name text not null,
  campaign_type text not null,
  status text not null,
  start_date date null,
  end_date date null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.awareness_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.awareness_campaigns(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid null,
  user_email text not null,
  user_name text null,
  status text not null,
  assigned_at timestamptz default now(),
  completed_at timestamptz null,
  score numeric null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.phishing_simulations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid null,
  campaign_id uuid references public.awareness_campaigns(id) on delete set null,
  name text not null,
  status text not null,
  sent_count integer default 0,
  opened_count integer default 0,
  clicked_count integer default 0,
  reported_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists awareness_campaigns_tenant_id_idx on public.awareness_campaigns (tenant_id);
create index if not exists awareness_campaigns_client_id_idx on public.awareness_campaigns (client_id);
create index if not exists awareness_campaigns_status_idx on public.awareness_campaigns (status);

create index if not exists awareness_assignments_tenant_id_idx on public.awareness_assignments (tenant_id);
create index if not exists awareness_assignments_client_id_idx on public.awareness_assignments (client_id);
create index if not exists awareness_assignments_campaign_id_idx on public.awareness_assignments (campaign_id);
create index if not exists awareness_assignments_status_idx on public.awareness_assignments (status);

create index if not exists phishing_simulations_tenant_id_idx on public.phishing_simulations (tenant_id);
create index if not exists phishing_simulations_client_id_idx on public.phishing_simulations (client_id);
create index if not exists phishing_simulations_campaign_id_idx on public.phishing_simulations (campaign_id);
create index if not exists phishing_simulations_status_idx on public.phishing_simulations (status);

alter table public.awareness_campaigns enable row level security;
alter table public.awareness_assignments enable row level security;
alter table public.phishing_simulations enable row level security;

drop policy if exists "Tenant members can read awareness campaigns" on public.awareness_campaigns;
create policy "Tenant members can read awareness campaigns"
on public.awareness_campaigns
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = awareness_campaigns.tenant_id
      and tu.user_id = auth.uid()
  )
);

drop policy if exists "Tenant operators can manage awareness campaigns" on public.awareness_campaigns;
create policy "Tenant operators can manage awareness campaigns"
on public.awareness_campaigns
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = awareness_campaigns.tenant_id
      and tu.user_id = auth.uid()
      and tu.role in ('owner', 'admin', 'analyst')
  )
)
with check (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = awareness_campaigns.tenant_id
      and tu.user_id = auth.uid()
      and tu.role in ('owner', 'admin', 'analyst')
  )
);

drop policy if exists "Tenant members can read awareness assignments" on public.awareness_assignments;
create policy "Tenant members can read awareness assignments"
on public.awareness_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = awareness_assignments.tenant_id
      and tu.user_id = auth.uid()
  )
);

drop policy if exists "Tenant operators can manage awareness assignments" on public.awareness_assignments;
create policy "Tenant operators can manage awareness assignments"
on public.awareness_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = awareness_assignments.tenant_id
      and tu.user_id = auth.uid()
      and tu.role in ('owner', 'admin', 'analyst')
  )
)
with check (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = awareness_assignments.tenant_id
      and tu.user_id = auth.uid()
      and tu.role in ('owner', 'admin', 'analyst')
  )
);

drop policy if exists "Tenant members can read phishing simulations" on public.phishing_simulations;
create policy "Tenant members can read phishing simulations"
on public.phishing_simulations
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = phishing_simulations.tenant_id
      and tu.user_id = auth.uid()
  )
);

drop policy if exists "Tenant operators can manage phishing simulations" on public.phishing_simulations;
create policy "Tenant operators can manage phishing simulations"
on public.phishing_simulations
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = phishing_simulations.tenant_id
      and tu.user_id = auth.uid()
      and tu.role in ('owner', 'admin', 'analyst')
  )
)
with check (
  exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = phishing_simulations.tenant_id
      and tu.user_id = auth.uid()
      and tu.role in ('owner', 'admin', 'analyst')
  )
);

drop trigger if exists set_awareness_campaigns_updated_at on public.awareness_campaigns;
create trigger set_awareness_campaigns_updated_at
before update on public.awareness_campaigns
for each row
execute function public.set_updated_at();

drop trigger if exists set_awareness_assignments_updated_at on public.awareness_assignments;
create trigger set_awareness_assignments_updated_at
before update on public.awareness_assignments
for each row
execute function public.set_updated_at();

drop trigger if exists set_phishing_simulations_updated_at on public.phishing_simulations;
create trigger set_phishing_simulations_updated_at
before update on public.phishing_simulations
for each row
execute function public.set_updated_at();
