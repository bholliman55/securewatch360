# Agent Tools Matrix (v1)

This document defines the v1 toolset for SecureWatch360 agents and the connector interfaces needed to automate their workflows.

## Agent 1 - Device scanning and asset inventory

Primary objective: discover and maintain an accurate asset inventory that feeds downstream vulnerability and compliance workflows.

Required tools:

- Network discovery: `nmap` (baseline)
- Cloud inventory APIs: AWS, Azure, GCP asset metadata feeds
- Internal source-of-truth storage: `scan_targets`, `scan_runs`, and asset context in findings evidence

Optional tools:

- High-speed discovery for large CIDR ranges: `masscan`
- DNS and service fingerprint enrichment

Automation mode:

- Scheduled discovery jobs publish `securewatch/scan.requested`
- New/changed assets become normalized scan targets for Agent 2 and Agent 5

## Agent 2 - Vulnerability scanning (infrastructure + code)

Primary objective: detect exploitable issues in runtime infrastructure and source code, then produce normalized findings for policy decisioning.

Required tools:

- Infrastructure scanning: Tenable/Nessus connector
- Code scanning: Semgrep connector
- CVE linkage: internal CVE catalog pipeline (`cve_catalog`, `finding_cves`)

Optional tools:

- Container and dependency coverage: Trivy
- Secrets detection: gitleaks

Automation mode:

- Event-driven and scheduled scans route through `runScanForTarget()`
- Findings normalize into a common shape for decisioning, remediation, and evidence

## Agent 3 - Compliance

Primary objective: map findings and controls to frameworks, evaluate policy, and generate auditable compliance artifacts.

Required tools:

- Policy decision engine (`evaluateDecision()`)
- Compliance mapping hook (`runComplianceAgentHook()`)
- Policy catalog/export APIs for Terraform and Ansible

Supported framework profiles:

- `soc2`, `cmmc`, `hipaa`, `nist`, `iso27001`, `pci_dss`, `cis`, `gdpr`, `fedramp`, `ccpa`, `cobit`

Automation mode:

- Compliance hook executes during scan workflow
- Evidence records and policy decisions are persisted automatically

## Agent 4 - Security awareness training

Primary objective: convert finding patterns and threat signals into role-based training recommendations and dispatch plans.

Required tools:

- Training planner (`buildAwarenessTrainingPlan()`)
- Awareness signal ingestion APIs
- Dispatch evidence tracking (`awareness_training_dispatch`)

Optional tools:

- LMS integration connector
- Chat/email campaign delivery connector

Automation mode:

- Training plans are derived on each completed scan run
- Dispatch can be triggered through API with auditable evidence output

## Agent 5 - Continuous monitoring (Tenable/Nessus and alerts)

Primary objective: continuously ingest alerts and external scanner telemetry, correlate with findings, and trigger incident workflows.

Required tools:

- Monitoring alert workflow (`securewatch/monitoring.alert.received`)
- Tenable/Nessus alert/result ingestion connector
- Incident response state machine APIs

Optional tools:

- SIEM connectors (Splunk/Sentinel/Elastic)
- Webhook relay for third-party scanner events

Automation mode:

- Continuous ingestion creates or updates findings in near real-time
- Escalation and incident progression are executed through workflow logic

## Shared remediation execution tools (v1)

Current routing hints and execution tool outputs support:

- `ansible_playbook`
- `shell_script`
- `cloud_provider_api`
- `terraform_apply`
- `workflow_job`
- `ticketing_system`
- `chatops_notification`

Connector adapters currently modeled in execution payload:

- `script_runner`
- `ansible`
- `cloud_api`
- `ticketing`

## Environment variables (v1 baseline)

Scanner/connectors:

- `TENABLE_BASE_URL`
- `TENABLE_ACCESS_KEY`
- `TENABLE_SECRET_KEY`
- `SEMGREP_API_URL` (optional; defaults to Semgrep cloud API)
- `SEMGREP_APP_TOKEN` (for authenticated Semgrep API access)
- `TRIVY_BINARY_PATH` (optional when running Trivy locally)

Scheduling and awareness:

- `AWARENESS_SIGNAL_TENANT_IDS`
- `SECURITY_AWARENESS_REAL_WORLD_SIGNALS`
- `SECURITY_AWARENESS_COMPANY_SIGNALS`
- `AWARENESS_REAL_WORLD_SIGNALS_URL`
- `AWARENESS_COMPANY_SIGNALS_URL`

Policy and export:

- `DECISION_ENGINE_PROVIDER`
- `OPA_POLICY_EVAL_URL`
- `POLICY_PACK_EXPORT_TOKEN`
- `POLICY_PACK_EXPORT_TENANT_IDS`

## API contract expectations for connector code

All connectors should return a normalized internal finding shape with:

- `externalId`
- `severity`
- `title`
- `description`
- `category`
- `cves[]`
- `metadata`

The scanner analyzer is responsible for converting connector output into persisted `findings` rows.

## Rollout plan

Phase 1 (MVP):

1. Add connector interfaces and fallback behavior.
2. Enable Tenable/Nessus pull for infra targets.
3. Enable Semgrep pull for code targets.
4. Normalize findings and validate end-to-end in scan workflow.

Phase 2 (Hardening):

1. Add Trivy and webhook ingestion paths.
2. Add retries, paging, and backoff for connector APIs.
3. Add connector health metrics and failure dashboards.
4. Add contract tests for each connector adapter.
