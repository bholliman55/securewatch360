---
name: adversarial-scan-qa
description: Run legal adversarial URL scanner coverage checks for SecureWatch360 and summarize what findings were detected per target. Use when validating scanner behavior against intentionally vulnerable test URLs, bad SSL demo hosts, or pre-demo security test drills.
---

# Adversarial Scan QA

## Purpose

Run repeatable scanner coverage checks against safe, authorized test targets that are intentionally misconfigured or vulnerable by design.

This skill is for **defensive validation** only.

## Safety Rules

- Use only targets you own, are authorized to test, or public intentionally vulnerable demo targets.
- Never run scans against unauthorized third-party systems.
- Prefer the default target list in `scripts/qa-v4-adversarial-targets.ts` unless the user provides approved targets.

## Quick Run

From repo root:

```bash
npx tsx scripts/qa-v4-adversarial-targets.ts
```

Optional custom target list:

```bash
ADVERSARIAL_TARGETS="http://testphp.vulnweb.com,https://expired.badssl.com,https://self-signed.badssl.com" npx tsx scripts/qa-v4-adversarial-targets.ts
```

PowerShell form:

```powershell
$env:ADVERSARIAL_TARGETS="http://testphp.vulnweb.com,https://expired.badssl.com,https://self-signed.badssl.com"; npx tsx scripts/qa-v4-adversarial-targets.ts
```

## Expected Output

The script prints:

- target URL
- created scan target id
- scan run id
- terminal run status
- finding totals by severity (`critical`, `high`, `medium`, `low`, `info`)

## Analysis Checklist

After run completion:

1. Confirm every target reached a terminal run state.
2. Confirm findings exist where expected for intentionally risky targets.
3. Flag false negatives (expected issue classes not surfaced).
4. Note any scanner timeout/hang patterns.
5. Recommend adapter tuning (timeouts, parser logic, severity mapping) only if coverage gaps are clear.

## Files Used

- Script: `scripts/qa-v4-adversarial-targets.ts`
- Core scan workflow: `src/inngest/functions/scan-tenant.ts`
- Scanner adapters:
  - `src/scanner/adapters/zap.ts`
  - `src/scanner/adapters/nmap.ts`
