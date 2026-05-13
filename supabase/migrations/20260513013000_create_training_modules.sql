-- SecureWatch360: Agent 4 / Security Awareness training modules.
-- Global rows (tenant_id null) provide starter content for every tenant.
-- Tenant rows can override/extend the catalog later without changing the UI.

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  title text not null,
  category text not null,
  description text,
  duration_minutes integer not null default 10,
  completion_rate integer not null default 0,
  passing_score integer not null default 80,
  status text not null default 'active',
  total_enrolled integer not null default 0,
  total_completed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_modules_status_check check (status in ('active', 'draft', 'archived')),
  constraint training_modules_completion_rate_check check (completion_rate >= 0 and completion_rate <= 100),
  constraint training_modules_passing_score_check check (passing_score >= 0 and passing_score <= 100),
  constraint training_modules_counts_check check (
    total_enrolled >= 0 and total_completed >= 0 and total_completed <= total_enrolled
  ),
  constraint training_modules_duration_check check (duration_minutes > 0)
);

comment on table public.training_modules is
  'Security Awareness / Agent 4 training module catalog and completion rollups.';

create index if not exists training_modules_tenant_id_idx
  on public.training_modules (tenant_id);

create index if not exists training_modules_status_idx
  on public.training_modules (status);

create index if not exists training_modules_category_idx
  on public.training_modules (category);

create unique index if not exists training_modules_global_title_uq
  on public.training_modules (lower(title))
  where tenant_id is null;

create unique index if not exists training_modules_tenant_title_uq
  on public.training_modules (tenant_id, lower(title))
  where tenant_id is not null;

alter table public.training_modules enable row level security;

drop policy if exists "training_modules_select_global_or_tenant_members"
  on public.training_modules;
create policy "training_modules_select_global_or_tenant_members"
  on public.training_modules for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = training_modules.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists "training_modules_insert_tenant_admins"
  on public.training_modules;
create policy "training_modules_insert_tenant_admins"
  on public.training_modules for insert to authenticated
  with check (
    tenant_id is not null
    and exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = training_modules.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('owner', 'admin')
    )
  );

drop policy if exists "training_modules_update_tenant_admins"
  on public.training_modules;
create policy "training_modules_update_tenant_admins"
  on public.training_modules for update to authenticated
  using (
    tenant_id is not null
    and exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = training_modules.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id is not null
    and exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = training_modules.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('owner', 'admin')
    )
  );

insert into public.training_modules (
  tenant_id,
  title,
  category,
  description,
  duration_minutes,
  completion_rate,
  passing_score,
  status,
  total_enrolled,
  total_completed
)
select
  null,
  seed.title,
  seed.category,
  seed.description,
  seed.duration_minutes,
  seed.completion_rate,
  seed.passing_score,
  seed.status,
  seed.total_enrolled,
  seed.total_completed
from (
  values
    (
      'Phishing Recognition and Reporting',
      'phishing',
      'Recognize suspicious email, messaging, and QR-code lures and report them quickly.',
      18,
      82,
      80,
      'active',
      120,
      98
    ),
    (
      'Credential Theft and MFA Hygiene',
      'identity',
      'Protect passwords, passkeys, MFA prompts, recovery codes, and privileged account access.',
      20,
      76,
      85,
      'active',
      120,
      91
    ),
    (
      'Ransomware Readiness for Staff',
      'ransomware',
      'Spot early ransomware indicators, preserve evidence, and escalate without spreading impact.',
      22,
      64,
      80,
      'active',
      120,
      77
    ),
    (
      'Secure Data Handling and HIPAA Privacy',
      'data_protection',
      'Handle sensitive data, PHI, exports, screenshots, and customer records safely.',
      25,
      71,
      85,
      'active',
      84,
      60
    ),
    (
      'Incident Reporting Tabletop',
      'incident_reporting',
      'Practice who to notify, what to capture, and how to respond during a suspected incident.',
      30,
      48,
      80,
      'active',
      42,
      20
    ),
    (
      'Cloud and SaaS Misconfiguration Basics',
      'cloud_security',
      'Reduce accidental exposure in SaaS sharing, storage buckets, tokens, and admin consoles.',
      16,
      0,
      80,
      'draft',
      0,
      0
    )
) as seed (
  title,
  category,
  description,
  duration_minutes,
  completion_rate,
  passing_score,
  status,
  total_enrolled,
  total_completed
)
where not exists (
  select 1
  from public.training_modules tm
  where tm.tenant_id is null
    and lower(tm.title) = lower(seed.title)
);
