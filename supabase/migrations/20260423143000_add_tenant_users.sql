-- SecureWatch360: tenant membership model
-- Connects Supabase auth users to tenants with role-based membership.

create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint tenant_users_role_check check (role in ('owner', 'admin', 'analyst', 'viewer')),
  constraint tenant_users_tenant_user_unique unique (tenant_id, user_id)
);

comment on table public.tenant_users is
  'Membership mapping between auth users and tenants with role-based access.';

comment on column public.tenant_users.role is
  'Tenant-scoped role: owner, admin, analyst, viewer.';

-- Useful query indexes
create index if not exists tenant_users_tenant_id_idx on public.tenant_users (tenant_id);
create index if not exists tenant_users_user_id_idx on public.tenant_users (user_id);
create index if not exists tenant_users_tenant_id_role_idx on public.tenant_users (tenant_id, role);
