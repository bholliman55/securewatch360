# Compliance org policy templates (Markdown)

Templates are generated from the same source as the policy pack catalog:

- SQL: `supabase/migrations/20260425150000_policy_pack_full_catalog.sql`
- Output: `data/compliance-templates/<framework>/controls/*.md`

## Generate or refresh

Single framework (codes match `policy_framework_profiles.framework_code`):

```bash
npm run generate:compliance-templates -- --framework=HIPAA
```

All frameworks in the generator allowlist:

```bash
npm run generate:compliance-templates:all
```

## Database alignment

After catalog changes, apply migrations and sync `control_requirements` from the policy catalog (see `20260428120000_sync_policy_catalog_to_control_requirements.sql`) so `complianceAgent` can resolve control UUIDs for `finding_control_mappings`.

## Policy-as-code

Framework-specific triage packages live under `policies/rego/securewatch360/` (e.g. `hipaa_ephi_triage.rego`, `framework_gdpr.rego`). Run `npm run qa:rego` with OPA installed to validate syntax.
