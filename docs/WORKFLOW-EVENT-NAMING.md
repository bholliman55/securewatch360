# SecureWatch360 Workflow and Event Naming

Practical naming rules for developers adding Inngest workflows, events, and DB statuses.

## 1) Event naming rules

- Format: `securewatch/<domain>.<action>[.<result>]`
- Use lowercase only.
- Use `/` once for namespace, then `.` for segments.
- Use past-tense for emitted facts (`.created`, `.received`), and `.requested` for intents.
- Keep payload keys camelCase and explicit (`tenantId`, `scanTargetId`).

Current implemented examples:

- `securewatch/scan.requested`
- `securewatch/monitoring.alert.received`

Reserved/future-compatible examples:

- `securewatch/findings.created`
- `securewatch/compliance.check.requested`
- `securewatch/remediation.requested`

## 2) Workflow/function naming rules (Inngest)

- `createFunction` id: kebab-case, stable, descriptive.
  - Format: `securewatch-<domain>-<action>`
- Function display name: short sentence case for logs/UI.
- Trigger event name in function config should match event naming rules exactly.

Current implemented examples:

- id: `securewatch-scan-requested`, event: `securewatch/scan.requested`
- id: `securewatch-monitoring-alert-received`, event: `securewatch/monitoring.alert.received`

Reserved/future-compatible examples:

- id: `securewatch-findings-created`, event: `securewatch/findings.created`
- id: `securewatch-compliance-check-requested`, event: `securewatch/compliance.check.requested`
- id: `securewatch-remediation-requested`, event: `securewatch/remediation.requested`

## 3) DB status naming rules

- Store statuses as lowercase snake_case text values.
- Prefer a small fixed set per table and enforce via DB check constraints.
- Use lifecycle ordering that reads naturally in queries and dashboards.

Current v4 patterns:

- `scan_targets.status`: `active`, `paused`, `archived`
- `scan_runs.status`: `queued`, `running`, `completed`, `failed`, `cancelled`
- `findings.status`: `open`, `acknowledged`, `in_progress`, `resolved`, `risk_accepted`

## 4) Quick consistency checklist

- Event name starts with `securewatch/`
- Function id starts with `securewatch-`
- Status values are lowercase and come from approved set
- Same concept uses the same word everywhere (e.g. `requested`, not mixed with `request`)
