# Compliance Scan

SecureWatch360 can run an automated compliance posture scan against a selected framework.  The scan evaluates evidence already in the platform (open findings, asset inventory, policies, scan history) and produces per-control results — pass / fail / partial / unknown — plus a readiness percentage and a prioritised gap list.

## Supported frameworks

| Value | Label | Adapter control catalogue |
|---|---|---|
| `cmmc_l1` | CMMC Level 1 | 17 controls (AC, IA, MP, PE, SC, SI domains) |
| `cmmc_l2` | CMMC Level 2 | Up to 110 controls (adds AU, CM, IR, SI domains) |
| `cis_v8` | CIS Controls v8 | 18 controls (Controls 1–18) |
| `nist_csf_2` | NIST CSF 2.0 | ~18 controls across GV, ID, PR, DE, RS, RC functions |
| `hipaa_security` | HIPAA Security Rule | ~10 controls (§164.308, §164.310, §164.312) |
| `soc2` | SOC 2 | ~12 controls (CC3, CC4, CC6, CC7, CC8) |

Controls are loaded from the `control_requirements` database table.  If the framework's rows are missing, a small built-in fallback set covers the most critical areas (asset inventory, vulnerability management, policy evidence, security awareness).

---

## Architecture

```
UI / API consumer
       │
       ▼
POST /api/scans/compliance
       │  (validates tenantId, framework, scope; checks tenant access)
       ▼
src/lib/complianceScan.ts  ── executeComplianceScan()
       │
       ├── collectEvidence()      ← counts findings, assets, policies from DB
       ├── loadControls()         ← queries control_requirements + fallback
       ├── evaluateComplianceControl()  ← per-control deterministic evaluation
       ├── summarizeComplianceResults() ← readiness %, top gaps
       │
       ├── Writes → scan_runs (status=completed, scanner_type=compliance)
       ├── Writes → compliance_scan_results (one row per control)
       └── Writes → findings (one row per non-pass control)
```

The scanner adapter (`src/scanner/adapters/compliance.ts`) is an alternative evaluation path used when the standard scan pipeline routes a `compliance_scope` target type.  Both paths share the same framework definitions but use slightly different evidence-gathering strategies (adapter uses open-findings keyword matching; `complianceScan.ts` uses DB count queries).

---

## Launching a compliance scan

### Via the API

```http
POST /api/scans/compliance
Content-Type: application/json

{
  "tenantId": "<uuid>",
  "framework": "cmmc_l1",
  "scope": "Production environment",
  "scanTargetIds": ["<uuid>", "<uuid>"]   // optional; scopes evidence to specific targets
}
```

**Required roles:** `owner`, `admin`, `analyst` (remediationAndScan role group).

**Response (201):**
```json
{
  "ok": true,
  "scanRunId": "<uuid>",
  "summary": {
    "readinessPercentage": 62,
    "passedControls": 5,
    "failedControls": 3,
    "partialControls": 4,
    "unknownControls": 5,
    "totalControls": 17,
    "topGaps": [ ... ]
  },
  "results": [ ... ]
}
```

### Via the UI

In the analyst console scan launcher, select **Compliance Scan** from the scan type dropdown and choose the target framework.  The UI calls `/api/scans/compliance` and renders results on the `ComplianceScanResults` component.

---

## Scan type routing

`src/lib/scanTypeRouting.ts` normalises free-form scan type strings from UI or API consumers into one of five canonical values, then maps each to its backend route.

| Canonical value | Backend route | Agent flags |
|---|---|---|
| `standard` | `/api/scans/request` | none |
| `agent1` | `/api/security/external-intelligence/run` | `runAgent1=true` |
| `agent2` | `/api/security/external-intelligence/run` | `runAgent2=true` |
| `external` (default) | `/api/security/external-intelligence/run` | both agents |
| `compliance` | `/api/scans/compliance` | none |

Common aliases that resolve to `compliance`: `compliance`, `compliance-scan`, `compliance_scan`.

```typescript
import { getScanTypeRoute } from "@/lib/scanTypeRouting";
const route = getScanTypeRoute("compliance-scan");
// route.backendRoute === "/api/scans/compliance"
```

---

## Control evaluation logic

### Evidence snapshot

Before evaluating controls, `collectEvidence()` gathers a snapshot from the tenant's database:

| Evidence field | Source |
|---|---|
| `assetCount` | `scan_targets` where `tenant_id = ?` (optionally filtered to `scanTargetIds`) |
| `openFindings` | `findings` where status ≠ `resolved` |
| `highCriticalFindings` | `findings` where severity ∈ `{high, critical}` and status ≠ `resolved` |
| `policyCount` | `policies` where `is_active = true` |
| `endpointCoverageKnown` | `false` — not yet automated |
| `mfaStatusKnown` | `false` — not yet automated |
| `backupStatusKnown` | `false` — not yet automated |
| `loggingMonitoringKnown` | `false` — not yet automated |
| `awarenessTrainingKnown` | `false` — not yet automated |

The five boolean fields are stubs for future evidence connectors.  Controls that depend solely on unknown booleans produce `status=unknown`.

### Per-control decision tree

`evaluateComplianceControl()` keyword-matches the control's code + title + description to select the evaluation branch:

| Keyword match | Branch |
|---|---|
| `vulnerab`, `risk`, `scan`, `ra-`, `si-2` | Vulnerability management branch — fails on open high/critical findings |
| `asset`, `inventory`, `boundary`, `configuration` | Asset inventory branch — partial if assets are registered |
| `policy`, `procedure`, `governance` | Policy branch — partial if policies exist in DB |
| `mfa`, `multi-factor`, `identity`, `access` | Auth branch — unknown until `mfaStatusKnown = true` |
| `backup`, `recovery`, `contingency` | Backup branch — unknown until `backupStatusKnown = true` |
| `log`, `monitor`, `audit` | Logging branch — unknown until `loggingMonitoringKnown = true` |
| `awareness`, `training` | Training branch — unknown until `awarenessTrainingKnown = true` |
| (any general evidence present) | Partial with low severity |

### Control statuses

| Status | Meaning |
|---|---|
| `pass` | No evidence of failure; up-to-date scan evidence present |
| `fail` | Open critical or high findings directly violate this control |
| `partial` | Medium/low findings or incomplete evidence — control partially satisfied |
| `unknown` | A required evidence field is `null` or `false`; cannot assess |
| `evidence_missing` | (scanner adapter only) No scan run or assets exist |

### Readiness score

```
readinessPercentage = round( (passed + partial × 0.5) / total × 100 )
```

---

## Database tables

| Table | Role |
|---|---|
| `scan_runs` | One row per compliance scan; `scanner_type = 'compliance'` |
| `compliance_scan_results` | One row per control per scan run |
| `findings` | Non-pass controls create open findings with `category = 'compliance'` |
| `control_requirements` | Source of truth for control definitions per framework |
| `control_frameworks` | Maps `framework_code` to framework metadata |

---

## Scanner adapter vs. complianceScan.ts

Two code paths can run compliance evaluations:

| Path | Entry point | Evidence strategy | Used by |
|---|---|---|---|
| **`complianceScan.ts`** | `POST /api/scans/compliance` | DB count queries (findings, assets, policies) | UI scan launcher, API consumers |
| **Scanner adapter** | Standard scan pipeline for `compliance_scope` target type | Keyword matching against up to 500 open findings | `getRecommendedScannersForTargetType("compliance_scope")` |

The scanner adapter path (`src/scanner/adapters/compliance.ts`) is richer for keyword-based control matching but does not persist `compliance_scan_results` rows — it produces findings through the standard `ScannerRunResult` interface.  Use the `/api/scans/compliance` path when you need structured compliance posture data and readiness percentages.

---

## Common pitfalls

- **All controls `unknown`:** The tenant has no assets or findings yet.  Register scan targets and run at least one scan before running a compliance scan.
- **Framework not found:** Pass one of the exact `value` strings from the supported frameworks table above.  The lookup is case-insensitive but must match after `trim().toLowerCase()`.
- **`control_requirements` fallback triggered:** The `control_frameworks` table is missing rows for this `frameworkCode`.  Apply the catalog migration (`supabase db push`) or seed the framework.
- **Findings not scoped correctly:** Pass `scanTargetIds` to limit evidence to specific assets; omit it to use all tenant-level evidence.
