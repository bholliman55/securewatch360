# HIPAA (Security Rule) in SecureWatch360

## Where the controls live (database)

The full **HIPAA Security Rule** control set used by the product catalog is loaded from `supabase/migrations/20260425150000_policy_pack_full_catalog.sql` (54 HIPAA controls, `framework_code = 'HIPAA'`), with Terraform/Ansible-style module path conventions for deployment metadata.

`control_requirements` is kept in sync with that catalog via migration `20260428120000_sync_policy_catalog_to_control_requirements.sql` so the **compliance agent** can resolve `(framework_code, control_code)` to UUIDs and write `finding_control_mappings` / evidence.

## Full operational scope (engineering)

What is implemented in-repo for HIPAA today:

| Layer | What it does |
|--------|----------------|
| **Catalog** | All HIPAA Security Rule controls in `policy_framework_controls` (policy pack migration). |
| **DB mapping rows** | Same controls copied into `control_requirements` (sync migration) for agent joins. |
| **Org documents** | One Markdown stub per control under `data/compliance-templates/hipaa/controls/` (regenerate with `npm run generate:compliance-templates -- --framework=HIPAA`). |
| **Compliance agent** | Category/title heuristics map findings to multiple HIPAA controls (administrative, audit, incident, awareness, transmission, contingency). See `src/lib/complianceAgent.ts`. |
| **Decision engine (rules)** | When category or `regulatedFrameworks` / `metadata.regulatedFrameworks` indicates HIPAA/ePHI, findings get `requiresApproval` and `metadata.hipaaStrictReview`. See `src/lib/decisionEngine.ts`. |
| **Rego (OPA)** | `policies/rego/securewatch360/hipaa_ephi_triage.rego` (`package securewatch.hipaa`) encodes similar ePHI signals for bundles that load this package. |

What still requires your program / deployment (not automatic from this repo alone):

- **OPA bundle wiring** so production `OPA_POLICY_PATH` (or merged data) evaluates `data.securewatch.hipaa` alongside `data.securewatch.v4.decision`.
- **Attested policies** (signed PDFs, committee approval) stored as your GRC process dictates, referenced from `evidence_records` if desired.
- **Privacy Rule / BAA** document packs (not the same as Subpart C technical safeguards).
- **Tenant-specific vocabulary** in `regulatedFrameworks` on `DecisionInput` when you know a target processes ePHI.

Authoritative HIPAA text: HHS / eCFR; this repo does not substitute legal counsel.

## Organization document templates (Markdown)

```bash
npm run generate:compliance-templates -- --framework=HIPAA
```

See also `docs/compliance/TEMPLATES.md` for all frameworks.

## Policy-as-code (Rego)

- **ePHI-oriented triage:** `policies/rego/securewatch360/hipaa_ephi_triage.rego`
- **v4 decision sample:** `policies/rego/securewatch360/v4_decision.rego`
- Validate: `npm run qa:rego` (requires `opa` on PATH).

## Next steps (product)

- Pass `regulatedFrameworks: ['hipaa']` (or metadata equivalent) from scan target / asset inventory into `DecisionInput` when assets are in scope for ePHI.
- Extend OPA policy graph to import `securewatch.hipaa` rules into the shipped decision document.
- Optional: Privacy Rule + BAA template packs and mappings in a follow-up PR.
