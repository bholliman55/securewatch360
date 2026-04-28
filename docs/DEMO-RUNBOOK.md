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
