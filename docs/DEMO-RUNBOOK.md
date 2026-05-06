# SecureWatch360 Demo Runbook (MVP/V1)

Use this one-page script to run a reliable product demo from the analyst console.

## Demo Goal

Show that SecureWatch360 can continuously monitor assets, execute scans, surface findings, and support analyst triage in a clean workflow.

## Pre-Demo Checks (2-3 minutes)

- Start app and open `/analyst`.
- Confirm you are in the test tenant (`TEST_TENANT_ID`).
- Open `Scanner` and verify:
  - Assets are visible (not empty).
  - Recent scans list is populated.
  - Pagination controls are visible.
- Verify recent adversarial run coverage:
  - 16/16 completed for the current target set.
  - Each run shows findings in storage (high + medium pattern is acceptable for demo).

## Recommended 10-Minute Flow

1. **Landing / Command Center (1 min)**
   - Show high-level risk posture and activity widgets.
   - Talk track: "This is the real-time security operations view per tenant."

2. **Scanner -> Assets (2 min)**
   - Navigate to `Scanner`.
   - Show monitored assets (scan targets), including adversarial test URLs.
   - Talk track: "In SecureWatch360, continuous monitoring starts by defining targets as assets."

3. **Scanner -> Recent Scans (2 min)**
   - Show completed runs and statuses.
   - Use pagination controls (Next/Previous) to prove list handling at scale.
   - Talk track: "Execution is asynchronous and resilient; completed runs roll into history immediately."

4. **Findings View / Risk Detail (2 min)**
   - Open findings and filter/sort by severity.
   - Highlight examples from `badssl` and `vulnweb` targets.
   - Talk track: "Findings are normalized and prioritized for triage."

5. **Approval / Workflow Story (2 min)**
   - Navigate to approvals or workflow-related panel.
   - Explain human-in-the-loop step for sensitive actions.
   - Talk track: "Automation is policy-driven with explicit approval gates where needed."

6. **Close with Monitoring Loop (1 min)**
   - Return to scanner metrics and recent activity.
   - Talk track: "SecureWatch360 continuously loops from detection to analyst action."

## Live Click Path (Quick Reference)

`/analyst` -> `Scanner` -> `Assets` -> `Recent Scans` (paginate) -> `Findings` -> `Approvals` -> back to dashboard

## Expected Demo Proof Points

- Assets are present and mapped to scan targets.
- Scans execute and persist as `scan_runs`.
- Findings persist and are severity-classified.
- UI is responsive in light mode and supports navigation/pagination.
- Tenant-scoped behavior works in the selected test tenant.

## Fast Recovery Plan (If Something Looks Off)

- Hard refresh browser (`Ctrl+F5`).
- Re-open `/analyst` and confirm tenant context.
- If scans are stale, trigger one scan from an existing adversarial target and refresh `Recent Scans`.
- If assets look empty, verify `scan_targets` exist for test tenant and reload scanner page.

## Simulation Lab Demo Mode

For investor briefings and pre-sales rehearsals you can drive the SecureWatch360 **Simulation Dashboard** with fictitious MSSP client fixtures instead of a live tenant.

### Enable demo mode

Set the environment variable before starting the Next.js dev server:

```bash
SIMULATION_DEMO_MODE=true npm run dev
```

Then run a golden-path scenario in demo mode in a second terminal:

```bash
SIMULATION_DEMO_MODE=true npm run sim:run-all
```

### What demo mode does

- Orchestration sink is forced to `local` — no Supabase writes, no Inngest events.
- Simulated events are annotated with fictitious MSSP company names and `*.sw360-demo.invalid` hostnames.
- Live remediation execution is blocked (`remediation_live_execution_blocked: true` in event metadata).
- Dashboard summary surfaces a prominent **"Demonstration / simulated data"** banner and `demo_disclaimer` text.
- `GET /api/simulation/demo-mode` returns `{ simulationDemoMode: true }` for badge rendering.

### Demo dashboard in the console

1. Navigate to the **Simulation** tab in the side menu (`/console/`).
2. The **Simulation Lab Briefing** panel pulls the latest persisted `dashboard_summary` from `.simulation-results/`.
3. Run `npm run sim:run-all` to generate or refresh results; click **Refresh summary** in the UI.
4. The autonomy score, scenario timeline, executive summary, and agent pass/fail counts update automatically.

### Golden-path scenarios available for demos

| Scenario | Narrative |
|----------|-----------|
| `golden-phishing-training-monitoring` | Employee phishing campaign → training dispatch + continuous monitoring |
| `golden-ransomware-isolated-incident-report` | Ransomware behaviour signal → endpoint isolation + full incident report |
| `golden-msp-rdp-remediated` | Public RDP exposure → firewall remediation via MSP ticketing |
| `golden-cmmc-drift-corrected` | CMMC control drift detected → corrective action + compliance snapshot |
| `golden-vulnerable-dependency-ticket` | CVE in dependency → ticket-driven patch workflow |

See [`simulator/README.md`](../simulator/README.md) for the full CLI reference and scenario schema.

---

## Known Demo Dataset

Current adversarial set includes:

- `http://testphp.vulnweb.com`
- `https://expired.badssl.com`
- `https://self-signed.badssl.com`
- `https://wrong.host.badssl.com`
- `https://untrusted-root.badssl.com`
- `https://revoked.badssl.com`
- `https://mixed-script.badssl.com`
- `https://mixed.badssl.com`
- `https://sha1-intermediate.badssl.com`
- `https://rc4.badssl.com`
- `https://tls-v1-0.badssl.com:1010`
- `https://tls-v1-1.badssl.com:1011`
- `https://cbc.badssl.com`
- `https://3des.badssl.com`
- `https://null.badssl.com`
- `https://http.badssl.com`
