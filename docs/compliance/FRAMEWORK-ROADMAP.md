# Compliance frameworks roadmap (policy catalog + policy-as-code)

Planned order for expanding org policy templates, Rego enforcement packages, and catalog alignment in SecureWatch360:

1. **HIPAA** (Security Rule 45 CFR Part 164 Subpart C; Privacy/BAA patterns as follow-on)
2. **CMMC**
3. **GDPR**
4. **CIS Controls**
5. **NIST** (CSF / 800-53 as referenced in catalog)
6. **PCI-DSS**
7. **FedRAMP**
8. **SOC 2**
9. **ISO 27001** (commonly written “ISO-27001”; not ISO 17001)

Each phase should: (a) confirm rows in `policy_framework_controls` / pack migrations, (b) add or refresh org document stubs under `data/compliance-templates/<framework>/`, (c) add or extend Rego under `policies/rego/securewatch360/`, (d) wire `complianceAgent` / decision inputs where machine enforcement applies.

## One-shot template generation (all catalog frameworks)

```bash
npm run generate:compliance-templates:all
```

Allowlisted codes: `HIPAA`, `CMMC`, `GDPR`, `CIS`, `NIST`, `PCI_DSS`, `FEDRAMP`, `SOC2`, `ISO27001`, `CCPA`, `COBIT` (aligned with `policy_framework_profiles`).

## Sync `control_requirements` from the catalog

Apply migration `20260428120000_sync_policy_catalog_to_control_requirements.sql` so `complianceAgent` control resolution works for every catalog control, not only the lean seed rows.

Note: Full legal attestation for any framework requires your counsel and entity-specific control implementation; this repository holds engineering artifacts and templates only.

---

## Live compliance scan (implemented)

Six frameworks are available as runnable posture scans today:

| Framework | Scan value | Controls evaluated |
|---|---|---|
| CMMC Level 1 | `cmmc_l1` | 17 |
| CMMC Level 2 | `cmmc_l2` | up to 110 |
| CIS Controls v8 | `cis_v8` | 18 |
| NIST CSF 2.0 | `nist_csf_2` | ~18 |
| HIPAA Security Rule | `hipaa_security` | ~10 |
| SOC 2 | `soc2` | ~12 |

Scans are launched from the UI (Compliance Scan type in the scan launcher) or via `POST /api/scans/compliance`.  Results are persisted in `compliance_scan_results` and surface as `findings` with `category = 'compliance'`.

See [`docs/COMPLIANCE-SCAN.md`](../COMPLIANCE-SCAN.md) for the full runbook including API reference, evaluation logic, and troubleshooting.
