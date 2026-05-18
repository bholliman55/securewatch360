# Security Awareness

`src/lib/securityAwareness.ts` is the service-layer module for security awareness and training.  It manages campaigns, individual assignments, phishing simulations, and generates data-driven training plans from current finding patterns.

## Domain model

```
AwarenessCampaign        (awareness_campaigns table)
  └── AwarenessAssignment[]  (awareness_assignments table)

PhishingSimulation       (phishing_simulations table)

AwarenessTrainingPlan    (generated in-memory; not persisted)
  └── AwarenessTrainingRecommendation[]
```

### AwarenessCampaign

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `tenant_id` | `string` | Multi-tenancy scope |
| `client_id` | `string \| null` | Optional sub-client scope |
| `name` | `string` | Campaign display name |
| `campaign_type` | `string` | Free-form (e.g. `phishing_simulation`, `module`) |
| `status` | `string` | `active`, `completed`, `cancelled`, etc. |
| `start_date` | `string \| null` | ISO date |
| `end_date` | `string \| null` | ISO date — used for overdue detection |

### AwarenessAssignment

| Field | Type | Notes |
|---|---|---|
| `user_email` | `string` | Unique identifier for the trainee |
| `status` | `string` | `assigned`, `completed`, `cancelled` |
| `completed_at` | `string \| null` | Set when the user finishes training |
| `score` | `number \| null` | Optional numeric score |

An assignment is considered **completed** when `status === 'completed'` or `completed_at` is non-null.  An assignment is **overdue** when it is not completed and the parent campaign's `end_date` is in the past.

### PhishingSimulation

| Field | Type | Notes |
|---|---|---|
| `sent_count` | `number \| null` | Emails sent in this simulation |
| `opened_count` | `number \| null` | Emails opened |
| `clicked_count` | `number \| null` | Links clicked (the key risk metric) |
| `reported_count` | `number \| null` | Reported to security team (positive signal) |

---

## Service functions

### Data fetchers

All three data fetchers accept `tenantId` (required) and an optional `clientId` to scope results to a sub-client:

```typescript
import {
  getAwarenessCampaigns,
  getAwarenessAssignments,
  getPhishingSimulations,
} from "@/lib/securityAwareness";

const campaigns = await getAwarenessCampaigns(tenantId);
const assignments = await getAwarenessAssignments(tenantId, clientId, campaignId);
const simulations = await getPhishingSimulations(tenantId);
```

`getAwarenessAssignments` also accepts an optional `campaignId` to filter to a single campaign.

### AwarenessMetrics

```typescript
import { calculateAwarenessMetrics } from "@/lib/securityAwareness";

const metrics = calculateAwarenessMetrics(campaigns, assignments, phishingSimulations);
```

Returns:

| Field | Calculation |
|---|---|
| `activeCampaigns` | Campaigns where `status.toLowerCase() === 'active'` |
| `completionRate` | `completed / total` assignments (0 if no assignments) |
| `overdueTraining` | Assignments that are incomplete and belong to a campaign whose `end_date` is in the past |
| `phishingClickRate` | `totalClicked / totalSent` across all simulations (0 if none sent) |

### Training plan generation

`buildAwarenessTrainingPlan()` produces a prioritised list of training recommendations by scoring open findings against seven topic areas.  It does not persist to the database.

```typescript
import { buildAwarenessTrainingPlan } from "@/lib/securityAwareness";

const plan = buildAwarenessTrainingPlan({
  tenantId,
  findings: [{ severity: "high", category: "phishing", title: "Credential phishing detected" }],
  realWorldSignals: ["ransomware surge Q2"],   // optional; overrides env var
  companySignals: ["M&A activity ongoing"],    // optional; overrides env var
});
```

#### Scoring topics

Each topic accumulates a weighted score from open findings.  A finding contributes to a topic if its `category + title` text matches topic keywords:

| Topic | Trigger keywords | Weight multiplier |
|---|---|---|
| `phishing` | `phish`, `social engineering` | 3× severity weight |
| `credential-theft` | `credential`, `password`, `token` | 3× severity weight |
| `ransomware` | `ransom`, `malware` | 3× severity weight |
| `web-security` | `xss`, `sql`, `injection`, `zap` | 2× severity weight |
| `cloud-misconfiguration` | `misconfig`, `public bucket`, `iam` | 2× severity weight |
| `endpoint-hardening` | `endpoint`, `port`, `network`, `exposure` | 2× severity weight |
| `incident-reporting` | (any non-info finding) | 1× severity weight |

Severity weight: `critical=5`, `high=4`, `medium=2`, `low/info=1`.

#### Priority thresholds

| Score | Priority |
|---|---|
| ≥ 20 | `urgent` |
| ≥ 10 | `elevated` |
| < 10 | `standard` |

#### Recommended format

| Topic | Format |
|---|---|
| `phishing` | `simulation` |
| `incident-reporting` | `tabletop` |
| all others | `micro-learning` |

The output includes at most 4 recommendations (highest-scoring topics only).  Topics with a score of 0 are excluded.

#### Signal inputs

`realWorldSignals` and `companySignals` are informational context strings that appear in the plan output as `basedOn` references.  If not passed, they are read from environment variables:

```
SECURITY_AWARENESS_REAL_WORLD_SIGNALS=ransomware surge,supply chain attacks
SECURITY_AWARENESS_COMPANY_SIGNALS=remote-first workforce,M&A activity
```

Both variables accept comma-separated values.

---

## Database tables

| Table | Purpose |
|---|---|
| `awareness_campaigns` | Campaign definitions scoped to tenant + optional client |
| `awareness_assignments` | Individual user training assignments within a campaign |
| `phishing_simulations` | Phishing simulation runs with engagement metrics |
| `training_modules` | Catalogue of available training content (separate from awareness service) |

---

## Hooks and UI integration

The console application uses `src/console/hooks/useTraining.ts` to fetch awareness data.  `src/console/services/trainingService.ts` calls the REST API layer.  Neither hook calls the service layer directly — server-side data access always goes through `securityAwareness.ts`.

---

## Common patterns

**Get completion rate for a campaign:**
```typescript
const assignments = await getAwarenessAssignments(tenantId, null, campaignId);
const metrics = calculateAwarenessMetrics([], assignments, []);
const rate = metrics.completionRate; // 0–1
```

**Generate a training plan from the current finding set:**
```typescript
// typically called from an Inngest function or API route after a scan completes
const plan = buildAwarenessTrainingPlan({ tenantId, findings: openFindings });
if (plan.recommendations[0]?.priority === "urgent") {
  // trigger alert or campaign creation
}
```

**Pitfall — overdue detection requires campaign end dates:**  An assignment is only flagged overdue when its parent campaign has a non-null `end_date` that is in the past.  Campaigns without an `end_date` never produce overdue counts.
