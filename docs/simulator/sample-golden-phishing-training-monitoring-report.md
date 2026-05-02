<!--
  Canonical lab output also written under simulator/reports/output/<runId>-securewatch-simulation-report.md
  when you run: npm run sim:run -- --scenario golden-phishing-training-monitoring
  then: npm run sim:report -- --runId <uuid>
-->
# Simulation run report

- **Simulation run ID:** `9baef1b4-47ab-46e6-b657-2103ea760ddb`
- **Scenario:** Golden path: phishing click drives training, monitoring uplift, and closed accountability (`golden-phishing-training-monitoring`)
- **Attack category:** phishing
- **Severity:** medium
- **Outcome:** FAIL
- **Generated:** 2026-05-02T19:01:23.675Z

## Timeline

| Offset (s) | Phase | Narrative | Source |
|------------|-------|-----------|--------|
| 0 | user_initiated_signal | Employee uses corporate reporting control to flag a suspicious payroll-themed message; SecureWatch normalizes the report into a positive security culture signal. | playbook |
| 180 | correlation_and_risk_scoring | URL maps to a benign demo landing host; risk engine still elevates training debt because similar themes trend in industry feeds (Fixture SOC Intel). | playbook |
| 600 | awareness_intervention | Micro-learning module assigned with optional manager digest; completion tracked to HRIS-friendly summary fields (synthetic). | playbook |
| 3600 | monitoring_hardening | Mail gateway / browser policy simulation adds heuristic for payroll-themed BEC patterns; alerting tuned to suppress noise while widening coverage windows. | playbook |

## Agents (validator checklist)

| Agent | Passed | Score | Issues |
|-------|--------|-------|--------|
| agent-1-scanner-external-recon | false | 86 | FAIL: database_record: Audit timeline did not include simulation-run correlated rows (check Supabase/wait tuning); WARN: triggered: Scenario not primarily scoped to Agent 1 — assertions relaxed; WARN: correct_event: N/A scope; WARN: severity_classification: N/A scope; WARN: expected_action: N/A scope; WARN: reportable_finding: N/A scope |
| agent-2-osint-vuln-intel | false | 86 | FAIL: database_record: No persistent audit breadcrumbs for simulated intel path; WARN: triggered: Scenario not principally owned by Agent 2 — assertions relaxed; WARN: correct_event: N/A scope; WARN: severity_classification: N/A scope; WARN: expected_action: N/A scope; WARN: reportable_finding: N/A scope |
| agent-3-compliance-policy | false | 29 | FAIL: triggered: Compliance/policy-as-code workflows not hinted in telemetry; FAIL: correct_event: Expected posture/policy drift flavored synthetic payloads missing; FAIL: expected_action: Expected gap analysis / playbook style actions absent; FAIL: database_record: No audit lineage showing compliance remediation hooks; FAIL: reportable_finding: No exportable gap/finding narration detected |
| agent-4-awareness-phishing-training | false | 71 | FAIL: expected_action: Expected nudges / ticketing / comms actions not observed; FAIL: database_record: No audit breadcrumbs for awareness handling |
| agent-5-monitoring-incident-response | false | 71 | FAIL: expected_action: Expected IR actions (escalation/containment) not detected; FAIL: database_record: Incident tracking / audit lineage absent |

### Playbook expected agent triggers

- **agent-4-awareness-phishing-training:** User-report pipeline drives calibrated training nudges and leadership digest.
- **agent-5-monitoring-incident-response:** Monitoring uplift and playbooks tightened for BEC heuristic coverage.

## Expected vs actual actions

| Step | Expected | Matched | Detail |
|------|----------|---------|--------|
| gp-phish-s1 | awareness-workflow / training_nudge_or_ticket_opened | false | Insufficient correlated audit/Inngest side-effects for agent_key=awareness-workflow |
| gp-phish-s2 | decision-engine / evaluation_record_written | false | Insufficient correlated audit/Inngest side-effects for agent_key=decision-engine |
| gp-phish-s3 | incident-coordinator / low_fidelity_case_opened_or_tagged | false | Insufficient correlated audit/Inngest side-effects for agent_key=incident-coordinator |

## Remediation results

- **Summary:** Complete targeted phishing-resilience curriculum slice, widen BEC detection heuristics, publish executive summary emphasizing culture metrics.
- **Human in the loop:** true
- **Expected action types:** micro_training_launch, detection_tune_request, executive_visibility_packet
- **Signal summary:** Outcome validations: 1/4 rows passed. Audit rows aligned to run: 0; timeline window rows: 0; poll_iterations=0.

### Playbook autonomous actions (synthetic)

- Send adaptive training assignment with SLA based on segmentation rules. (`conditional_operator_confirm`)

### Human approval gates (synthetic)

- **comms_tone_and_escalation:** HR and Legal confirm messaging avoids punitive optics while maintaining accountability narrative.

## Policy controls tested

| Framework | Control | Label |
|-----------|---------|-------|
| nist_csf | PR.AT-1 | Roles and responsibilities understood |
| soc2 | CC2.2 | Communication relevant to obligations |

**Validation:** No minimum control matches required.

## Autonomy score

- **Overall:** 43 / 100
- **Readiness:** Not ready (`not_ready`)
- **Rates:** detection 0.0%, agent accuracy 68.6%, remediation 0.0%, policy 100.0%
- **Risks:** FP 55.6%, FN 100.0%, human burden 57.0%
- **Times (s):** detect 0, triage 0, remediate 0
- **Report quality:** 70

## Critical failures

- [validation] gp-phish-s1: Insufficient correlated audit/Inngest side-effects for agent_key=awareness-workflow
- [validation] gp-phish-s2: Insufficient correlated audit/Inngest side-effects for agent_key=decision-engine
- [validation] gp-phish-s3: Insufficient correlated audit/Inngest side-effects for agent_key=incident-coordinator
- [agent:agent-1-scanner-external-recon] database_record: Audit timeline did not include simulation-run correlated rows (check Supabase/wait tuning)
- [agent:agent-2-osint-vuln-intel] database_record: No persistent audit breadcrumbs for simulated intel path
- [agent:agent-3-compliance-policy] triggered: Compliance/policy-as-code workflows not hinted in telemetry
- [agent:agent-3-compliance-policy] correct_event: Expected posture/policy drift flavored synthetic payloads missing
- [agent:agent-3-compliance-policy] expected_action: Expected gap analysis / playbook style actions absent
- [agent:agent-3-compliance-policy] database_record: No audit lineage showing compliance remediation hooks
- [agent:agent-3-compliance-policy] reportable_finding: No exportable gap/finding narration detected
- [agent:agent-4-awareness-phishing-training] expected_action: Expected nudges / ticketing / comms actions not observed
- [agent:agent-4-awareness-phishing-training] database_record: No audit breadcrumbs for awareness handling
- [agent:agent-5-monitoring-incident-response] expected_action: Expected IR actions (escalation/containment) not detected
- [agent:agent-5-monitoring-incident-response] database_record: Incident tracking / audit lineage absent

## Recommended fixes

- Clear expectation "gp-phish-s1": Insufficient correlated audit/Inngest side-effects for agent_key=awareness-workflow. Add audit correlation or relax pass rules if this is a lab-only gap.
- Clear expectation "gp-phish-s2": Insufficient correlated audit/Inngest side-effects for agent_key=decision-engine. Add audit correlation or relax pass rules if this is a lab-only gap.
- Clear expectation "gp-phish-s3": Insufficient correlated audit/Inngest side-effects for agent_key=incident-coordinator. Add audit correlation or relax pass rules if this is a lab-only gap.
- Improve agent-1-scanner-external-recon integration (score 86): database_record: Audit timeline did not include simulation-run correlated rows (check Supabase/wait tuning)
- Improve agent-2-osint-vuln-intel integration (score 86): database_record: No persistent audit breadcrumbs for simulated intel path
- Improve agent-3-compliance-policy integration (score 29): triggered: Compliance/policy-as-code workflows not hinted in telemetry; correct_event: Expected posture/policy drift flavored synthetic payloads missing
- Improve agent-4-awareness-phishing-training integration (score 71): expected_action: Expected nudges / ticketing / comms actions not observed; database_record: No audit breadcrumbs for awareness handling
- Improve agent-5-monitoring-incident-response integration (score 71): expected_action: Expected IR actions (escalation/containment) not detected; database_record: Incident tracking / audit lineage absent
- Raise autonomy (current 43, band not_ready): strengthen detection correlation, reduce false-positive/false-negative risk, or trim human gates where policy allows.

## Telemetry

- mode: local
- emissions: 2
- audit aligned / timeline: 0 / 0, polls 0
- observation window: 2026-05-02T19:00:06.122Z → 2026-05-02T19:00:06.397Z
