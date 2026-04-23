-- SecureWatch360: basic compliance control mapping (lean v1)
-- Purpose:
-- 1) define compliance frameworks
-- 2) define controls/requirements in each framework
-- 3) map findings to controls for tenant-scoped compliance tracking

create table if not exists public.control_frameworks (
  id uuid primary key default gen_random_uuid(),
  framework_code text not null unique,
  framework_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.control_frameworks is
  'Supported control frameworks (CMMC, SOC2, HIPAA, NIST) used by compliance mapping.';

create table if not exists public.control_requirements (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.control_frameworks (id) on delete cascade,
  control_code text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint control_requirements_framework_code_uniq unique (framework_id, control_code)
);

comment on table public.control_requirements is
  'Individual controls/requirements within a framework, e.g. SOC2 CC6.1.';

create table if not exists public.finding_control_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  control_requirement_id uuid not null references public.control_requirements (id) on delete cascade,
  mapping_source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finding_control_mappings_uniq unique (tenant_id, finding_id, control_requirement_id)
);

comment on table public.finding_control_mappings is
  'Tenant-scoped link between findings and control requirements.';

create index if not exists control_requirements_framework_id_idx
  on public.control_requirements (framework_id);

create index if not exists finding_control_mappings_tenant_id_idx
  on public.finding_control_mappings (tenant_id);

create index if not exists finding_control_mappings_control_requirement_id_idx
  on public.finding_control_mappings (control_requirement_id);

create index if not exists finding_control_mappings_finding_id_idx
  on public.finding_control_mappings (finding_id);

insert into public.control_frameworks (framework_code, framework_name)
values
  ('CMMC', 'Cybersecurity Maturity Model Certification'),
  ('SOC2', 'Service Organization Control 2'),
  ('HIPAA', 'Health Insurance Portability and Accountability Act'),
  ('NIST', 'NIST Cybersecurity Framework')
on conflict (framework_code) do update
set framework_name = excluded.framework_name;

insert into public.control_requirements (framework_id, control_code, title, description)
values
  (
    (select id from public.control_frameworks where framework_code = 'SOC2'),
    'CC6.1',
    'Logical and physical access controls',
    'Organization implements controls to restrict logical and physical access.'
  ),
  (
    (select id from public.control_frameworks where framework_code = 'NIST'),
    'PR.AC-1',
    'Identities and credentials managed',
    'Identities and credentials are issued, managed, verified, and revoked.'
  ),
  (
    (select id from public.control_frameworks where framework_code = 'HIPAA'),
    '164.308(a)(1)',
    'Security management process',
    'Implement policies and procedures to prevent, detect, contain, and correct security violations.'
  ),
  (
    (select id from public.control_frameworks where framework_code = 'CMMC'),
    'AC.L1-3.1.1',
    'Limit system access to authorized users',
    'Limit information system access to authorized users, processes acting on behalf of authorized users, or devices.'
  )
on conflict (framework_id, control_code) do update
set
  title = excluded.title,
  description = excluded.description;
