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

Note: Full legal attestation for any framework requires your counsel and entity-specific control implementation; this repository holds engineering artifacts and templates only.
