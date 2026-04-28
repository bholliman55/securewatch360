# HIPAA (Security Rule) in SecureWatch360

## Where the controls live (database)

The full **HIPAA Security Rule** control set used by the product catalog is loaded from `supabase/migrations/20260425150000_policy_pack_full_catalog.sql` (54 HIPAA controls, `framework_code = 'HIPAA'`), with Terraform/Ansible-style module path conventions for deployment metadata.

The lean mapping table `control_requirements` (see `20260423180000_add_compliance_control_mapping.sql`) contains a small seed; the **authoritative** list for policy pack exports is the **full catalog** migration above.

## Organization document templates (Markdown)

- **Per-control stubs:** `data/compliance-templates/hipaa/controls/` (one file per Security Rule control in the catalog).
- **Regenerate** from the migration after catalog edits:

```bash
node scripts/generate-hipaa-org-template-stubs.mjs
```

Each file is a starting point for policies/procedures: replace bracketed text, add real scope, owners, and evidence. These are **not** legal advice.

## Policy-as-code (Rego)

- **ePHI-oriented triage bias:** `policies/rego/securewatch360/hipaa_ephi_triage.rego` (`package securewatch.hipaa`) — use when `input.category` can surface health/PHI/HIPAA context.
- **Broader v4 decision sample:** `policies/rego/securewatch360/v4_decision.rego`
- OPA validation: `npm run qa:rego` (requires `opa` on PATH).

## Authoritative rule text

U.S. **HIPAA** Security Rule text is published by HHS; verify control wording and organizational obligations against the current CFR and your legal review.

## Next steps (product)

- Tighten `complianceAgent` category → HIPAA control mappings for your tenant vocabulary.
- Store signed policy PDFs or ticket links as `evidence_records` where required.
- Optionally split Privacy Rule / BAA templates in a follow-up (not identical to Subpart C technical controls).
