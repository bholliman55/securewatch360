-- SecureWatch360: expand policy_framework_controls beyond starter rows (one additional control per framework)

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
    ('SOC2', 'CC6.6', 'Logical access changes', 'Restrict and log privileged access changes across production systems.', 'enforced', 'modules/policies/soc2_cc6_6', 'roles/policy_soc2_cc6_6'),
    ('CMMC', 'SC.L1-3.13.11', 'Boundary protection', 'Protect CUI at system boundaries with monitoring and segmentation.', 'enforced', 'modules/policies/cmmc_sc_l1_3_13_11', 'roles/policy_cmmc_sc_l1_3_13_11'),
    ('HIPAA', '164.312(a)(2)(i)', 'Unique user identification', 'Assign unique identifiers to workforce members accessing ePHI systems.', 'enforced', 'modules/policies/hipaa_164_312_a_2_i', 'roles/policy_hipaa_164_312_a_2_i'),
    ('NIST', 'PR.DS-5', 'Protections against data leaks', 'Implement protections for data-at-rest and data-in-transit commensurate with risk.', 'enforced', 'modules/policies/nist_pr_ds_5', 'roles/policy_nist_pr_ds_5'),
    ('ISO27001', 'A.8.20', 'Networks security', 'Networks and network services shall be secured, managed, and monitored.', 'enforced', 'modules/policies/iso27001_a_8_20', 'roles/policy_iso27001_a_8_20'),
    ('PCI_DSS', '8.3', 'Multi-factor authentication', 'Require MFA for all access into the CDE.', 'enforced', 'modules/policies/pci_dss_8_3', 'roles/policy_pci_dss_8_3'),
    ('CIS', '4.2', 'Secure configuration of enterprise assets', 'Ensure secure configuration of end-user devices, servers, and network gear.', 'enforced', 'modules/policies/cis_4_2', 'roles/policy_cis_4_2'),
    ('GDPR', '25', 'Data protection by design and by default', 'Implement technical and organizational measures to implement data protection principles.', 'enforced', 'modules/policies/gdpr_25', 'roles/policy_gdpr_25'),
    ('FEDRAMP', 'SI-4', 'System monitoring', 'Monitor the information system to detect attacks and unauthorized activity.', 'enforced', 'modules/policies/fedramp_si_4', 'roles/policy_fedramp_si_4'),
    ('CCPA', '1798.100', 'Consumer right to know', 'Provide required disclosures about personal information collection and use.', 'advisory', 'modules/policies/ccpa_1798_100', 'roles/policy_ccpa_1798_100'),
    ('COBIT', 'BAI10', 'Configuration management', 'Establish and maintain configuration baselines and change control.', 'enforced', 'modules/policies/cobit_bai10', 'roles/policy_cobit_bai10')
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
