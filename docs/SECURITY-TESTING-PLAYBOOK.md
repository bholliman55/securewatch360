# Security Testing Playbook

This playbook defines a practical, low-cost security testing baseline for SecureWatch360.
It is designed to run locally and in CI using free tools or free trial tiers.

## Objectives

- Catch web app vulnerabilities early (DAST).
- Catch dependency and code vulnerabilities early (SCA + SAST).
- Catch infrastructure/container misconfigurations (IaC + image/fs scanning).
- Add external attack-surface visibility and OSINT monitoring.

## Recommended Free/Trial Tooling

- **DAST (web runtime):** OWASP ZAP baseline (free, OSS)
- **SCA (dependencies):** Snyk Open Source (`snyk test`) free tier or `npm audit` fallback
- **SAST (code):** Semgrep Community (`p/owasp-top-ten`, `p/secrets`)
- **Infra/Image/Config/Secrets:** Trivy (`fs`, `image`, `config`, `secret`)
- **Optional code quality + security hotspots:** SonarCloud/SonarQube Community
- **OSINT / external footprint:** OWASP Amass + theHarvester + nuclei

## Prerequisites

- Docker Desktop
- Node 20+
- Running app target for DAST (local or staging)

Optional CLI installs:

- Trivy: [https://trivy.dev/latest/getting-started/installation/](https://trivy.dev/latest/getting-started/installation/)
- Semgrep: [https://semgrep.dev/docs/getting-started/](https://semgrep.dev/docs/getting-started/)
- Snyk CLI: [https://docs.snyk.io/snyk-cli/install-the-snyk-cli](https://docs.snyk.io/snyk-cli/install-the-snyk-cli)
- OWASP Amass: [https://owasp.org/www-project-amass/](https://owasp.org/www-project-amass/)
- theHarvester: [https://github.com/laramies/theHarvester](https://github.com/laramies/theHarvester)
- nuclei: [https://github.com/projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei)

## Baseline Test Flow (weekly minimum)

1. SCA (`snyk test` and/or `npm audit`)
2. SAST (`semgrep`)
3. Infra/container/config/secrets (`trivy`)
4. DAST (`OWASP ZAP baseline`)
5. OSINT attack-surface pass (Amass/theHarvester/nuclei on approved targets)
6. Track findings in backlog with severity, owner, SLA, and retest date

## Commands

### 1) Dependency vulnerability checks (SCA)

Snyk (preferred where available):

```bash
npx snyk auth
npx snyk test --severity-threshold=high
```

Fallback (always available for npm):

```bash
npm audit --audit-level=high
```

### 2) Code security checks (SAST)

```bash
npx semgrep --config p/owasp-top-ten --config p/secrets --error
```

### 3) Infra, config, and secrets scanning

Filesystem and IaC scan:

```bash
trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL .
```

Container image scan (example):

```bash
trivy image --severity HIGH,CRITICAL ghcr.io/your-org/securewatch360:latest
```

### 4) DAST with OWASP ZAP

Use existing helper script in this repository:

```bash
scripts\zap-baseline.cmd -t http://host.docker.internal:3000 -m 2
```

For staged endpoints:

```bash
scripts\zap-baseline.cmd -t https://staging.your-domain.tld -m 5
```

Notes:

- `-m` controls spider minutes; increase for deeper coverage.
- Run authenticated scans only on approved non-production environments.

### 5) OSINT and attack-surface checks

Run only against domains/assets you own or are authorized to test.

Subdomain enumeration:

```bash
amass enum -passive -d your-domain.tld -o amass-subdomains.txt
```

Email/host intelligence:

```bash
theHarvester -d your-domain.tld -b all -f theharvester-output
```

Template-based exposure checks:

```bash
nuclei -l amass-subdomains.txt -severity medium,high,critical -o nuclei-findings.txt
```

## CI Recommendation (free-first)

At minimum in CI:

- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=high`
- `npx semgrep --config p/owasp-top-ten --error`
- `trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL .`

Nightly or scheduled:

- `scripts\zap-baseline.cmd` against staging URL
- OSINT scans on approved external domains

## SonarQube/SonarCloud Guidance

- **SonarCloud:** easiest hosted trial/free tier for fast startup.
- **SonarQube Community:** free self-hosted option if you want local control.
- Keep Sonar for quality/security hotspots; do not use it as the only vulnerability source.

## Triage and Acceptance Criteria

- **Critical/High:** fixed or compensating control documented before release.
- **Medium:** scheduled with owner + due date.
- **False positives:** documented with rationale and expiration review date.
- Re-run relevant scanner after remediation and attach evidence to ticket.

## Ownership

- Security testing owner: AppSec lead or engineering manager.
- Each finding must have: severity, asset, owner, due date, and verification evidence.
