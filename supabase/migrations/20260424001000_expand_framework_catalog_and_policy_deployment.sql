-- SecureWatch360: expand compliance frameworks + deployment-ready policy catalog
-- Purpose:
-- 1) support 11 frameworks (up from 4)
-- 2) store framework policy controls with deployable Terraform/Ansible metadata

insert into public.control_frameworks (framework_code, framework_name)
values
  ('ISO27001', 'ISO/IEC 27001'),
  ('PCI_DSS', 'Payment Card Industry Data Security Standard'),
  ('CIS', 'CIS Controls'),
  ('GDPR', 'General Data Protection Regulation'),
  ('FEDRAMP', 'Federal Risk and Authorization Management Program'),
  ('CCPA', 'California Consumer Privacy Act'),
  ('COBIT', 'Control Objectives for Information and Related Technologies')
on conflict (framework_code) do update
set framework_name = excluded.framework_name;

create table if not exists public.policy_framework_profiles (
  id uuid primary key default gen_random_uuid(),
  framework_code text not null unique,
  framework_name text not null,
  framework_version text not null default 'latest',
  deployment_targets text[] not null default array['terraform', 'ansible'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.policy_framework_profiles is
  'Canonical framework catalog for policy deployment and control packaging.';

create table if not exists public.policy_framework_controls (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.policy_framework_profiles (id) on delete cascade,
  control_code text not null,
  policy_title text not null,
  policy_body text not null default '',
  enforcement_mode text not null default 'advisory',
  terraform_module text,
  ansible_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_framework_controls_profile_control_uniq unique (profile_id, control_code)
);

comment on table public.policy_framework_controls is
  'Framework-specific policy controls with deployment mappings (Terraform/Ansible).';

create index if not exists policy_framework_controls_profile_id_idx
  on public.policy_framework_controls (profile_id);

create index if not exists policy_framework_controls_control_code_idx
  on public.policy_framework_controls (control_code);

insert into public.policy_framework_profiles (framework_code, framework_name, framework_version)
values
  ('SOC2', 'Service Organization Control 2', '2017'),
  ('CMMC', 'Cybersecurity Maturity Model Certification', '2.0'),
  ('HIPAA', 'Health Insurance Portability and Accountability Act', '164'),
  ('NIST', 'NIST Cybersecurity Framework', '2.0'),
  ('ISO27001', 'ISO/IEC 27001', '2022'),
  ('PCI_DSS', 'Payment Card Industry Data Security Standard', '4.0'),
  ('CIS', 'CIS Controls', '8.1'),
  ('GDPR', 'General Data Protection Regulation', '2016/679'),
  ('FEDRAMP', 'Federal Risk and Authorization Management Program', 'Rev5'),
  ('CCPA', 'California Consumer Privacy Act', '1798'),
  ('COBIT', 'Control Objectives for Information and Related Technologies', '2019')
on conflict (framework_code) do update
set
  framework_name = excluded.framework_name,
  framework_version = excluded.framework_version,
  updated_at = now();

insert into public.policy_framework_controls (
  profile_id,
  control_code,
  policy_title,
  policy_body,
  enforcement_mode,
  terraform_module,
  ansible_role
)
select p.id, x.control_code, x.policy_title, x.policy_body, x.enforcement_mode, x.terraform_module, x.ansible_role
from public.policy_framework_profiles p
join (
  values
    ('SOC2', 'CC6.1', 'Access control baseline', 'Enforce least privilege and periodic access reviews.', 'enforced', 'modules/policies/soc2_cc6_1', 'roles/policy_soc2_cc6_1'),
    ('CMMC', 'AC.L1-3.1.1', 'Authorized access policy', 'Restrict system access to authorized users and devices.', 'enforced', 'modules/policies/cmmc_ac_l1_3_1_1', 'roles/policy_cmmc_ac_l1_3_1_1'),
    ('HIPAA', '164.308(a)(1)', 'Security management process', 'Implement safeguards to prevent, detect, contain, and correct violations.', 'enforced', 'modules/policies/hipaa_164_308_a_1', 'roles/policy_hipaa_164_308_a_1'),
    ('NIST', 'PR.AC-1', 'Identity and credential controls', 'Manage issuance, revocation, and review of credentials.', 'enforced', 'modules/policies/nist_pr_ac_1', 'roles/policy_nist_pr_ac_1'),
    ('ISO27001', 'A.5.15', 'Access management', 'Implement policy-based user access management controls.', 'enforced', 'modules/policies/iso27001_a_5_15', 'roles/policy_iso27001_a_5_15'),
    ('PCI_DSS', '7.2', 'Least privilege policy', 'Grant access by job role and business need-to-know.', 'enforced', 'modules/policies/pci_dss_7_2', 'roles/policy_pci_dss_7_2'),
    ('CIS', '6.1', 'Access control management', 'Establish secure account and privilege management controls.', 'enforced', 'modules/policies/cis_6_1', 'roles/policy_cis_6_1'),
    ('GDPR', '32', 'Security of processing', 'Apply technical and organizational measures to protect personal data.', 'enforced', 'modules/policies/gdpr_32', 'roles/policy_gdpr_32'),
    ('FEDRAMP', 'AC-2', 'Account management', 'Manage information system accounts through lifecycle controls.', 'enforced', 'modules/policies/fedramp_ac_2', 'roles/policy_fedramp_ac_2'),
    ('CCPA', '1798.150', 'Reasonable security procedures', 'Maintain reasonable security controls over personal information.', 'advisory', 'modules/policies/ccpa_1798_150', 'roles/policy_ccpa_1798_150'),
    ('COBIT', 'DSS05', 'Managed security services', 'Define and maintain managed security services controls.', 'advisory', 'modules/policies/cobit_dss05', 'roles/policy_cobit_dss05')
) as x(framework_code, control_code, policy_title, policy_body, enforcement_mode, terraform_module, ansible_role)
  on x.framework_code = p.framework_code
on conflict (profile_id, control_code) do update
set
  policy_title = excluded.policy_title,
  policy_body = excluded.policy_body,
  enforcement_mode = excluded.enforcement_mode,
  terraform_module = excluded.terraform_module,
  ansible_role = excluded.ansible_role,
  updated_at = now();
