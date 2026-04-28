# Organization policy and procedures (stub)

**Framework:** NIST (SecureWatch360 policy pack catalog)  
**Control:** `PR.AT-02`  
**Summary:** Individuals in specialized roles are provided with awareness and training so that they possess the knowledge and skills to perform relevant tasks with cybersecurity risks in mind

## Purpose

Organization-level policy/procedure template aligned to control `PR.AT-02`. Replace bracketed fields; not legal advice.

## Scope

- **Organization:** [Name]  
- **Systems / data in scope:** [Describe]  
- **Roles:** [List]

## Policy statements

1. [Plain-language implementation of the control for your environment.]
2. [Evidence ownership, tooling (e.g. SecureWatch360), and review cadence.]

## Roles and responsibilities

| Role     | Responsibility |
|----------|------------------|
| [Title]  | [Duty]           |

## Evidence and review

- **Evidence:** [policies, tickets, scans, training, contracts, logs, etc.]
- **Review cadence:** [e.g. annual / on change]
- **Catalog note:** advisory

## Policy-as-code pairing

- Enforceable checks belong in Rego under `policies/rego/securewatch360/` (see framework triage stubs and v4 decision bundle).
- Catalog metadata (Terraform/Ansible paths) lives in `policy_framework_controls` for this control.

---
*Stub generated from repo migration extract; customize before attestation.*
