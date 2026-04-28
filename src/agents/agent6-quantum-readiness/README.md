# Agent 6: Quantum Risk & Crypto Agility Module

Discovers cryptographic assets, identifies quantum-vulnerable algorithms, calculates a Quantum Readiness Score, maps findings to compliance controls and policy-as-code rules, and generates prioritised remediation recommendations.

---

## Purpose

Post-quantum cryptography (PQC) migration is a multi-year initiative driven by NIST's finalisation of FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and FIPS 205 (SLH-DSA). Agent 6 gives MSP clients actionable visibility into their cryptographic posture before a cryptographically-relevant quantum computer (CRQC) arrives.

Key threats addressed:
- **Shor's algorithm** — breaks RSA, ECC, ECDSA, ECDH, DH, DSA
- **Grover's algorithm** — halves symmetric key security (AES-128 → ~64-bit)
- **Harvest-now-decrypt-later (HNDL)** — adversaries collect ciphertext today for future quantum decryption

---

## Module Structure

```
agent6-quantum-readiness/
├── types.ts                  # All TypeScript types and interfaces
├── quantumRiskEngine.ts      # Algorithm database + per-asset risk analysis
├── cryptoInventoryScanner.ts # Finding-to-inventory conversion + metadata ingestion
├── quantumReadinessScoring.ts# Aggregate Quantum Readiness Score (0–100)
├── remediationPlanner.ts     # Prioritised QuantumRemediationTask generation
├── policyMapper.ts           # Compliance control mapping + OPA policy evaluation
├── samplePayloads.ts         # Synthetic test data (no client-specific values)
└── tests/
    ├── quantumRiskEngine.test.ts
    └── quantumReadinessScoring.test.ts
```

---

## Key Types

| Type | Description |
|------|-------------|
| `CryptoInventoryItem` | One discovered cryptographic asset (DB row shape) |
| `QuantumReadinessAssessment` | Aggregate score + counts per client/scan |
| `QuantumRemediationTask` | Actionable task for a specific asset |
| `QuantumPolicyResult` | Per-asset pass/fail for a named policy rule |
| `QuantumPolicyMapping` | Framework control gap mapping |

---

## Scoring Model

Score starts at **100** and deducts:

| Finding Level | Penalty |
|---------------|---------|
| critical | −20 each |
| high | −12 each |
| medium | −6 each |
| unknown | −3 each |
| Harvest-now exposure | −15 (one-time) |
| No inventory | Score = 0 |

Score is clamped to `[0, 100]`.

**Grade thresholds:**

| Score | Priority |
|-------|----------|
| 0–39 | critical |
| 40–69 | high |
| 70–84 | medium |
| 85–100 | low |

---

## Quantum Risk Levels

| Level | Algorithms | Threat |
|-------|-----------|--------|
| critical | RSA <2048, SHA-1, MD5, 3DES, RC4, TLS 1.0/1.1 | Immediately exploitable classically or near-term quantum |
| high | RSA-2048+, ECDSA, ECDH on public-facing assets | Shor's algorithm breaks on CRQC arrival |
| medium | RSA/ECC on internal assets, AES-128 | Lower urgency but must migrate before CRQC |
| low | AES-256, SHA-384/512 | Grover-weakened but acceptable long-term |
| none | ML-KEM, ML-DSA, SLH-DSA, FALCON | NIST-approved post-quantum |

---

## Algorithm Database

The engine covers:

**Quantum-vulnerable:**
RSA-1024/2048/3072/4096, ECDSA-P256/P384, ECDH-P256, DH-2048, DSA-2048, AES-128, 3DES, RC4, SHA-1, MD5, SHA-256

**Quantum-resistant (NIST PQC):**
ML-KEM-512/768/1024 (FIPS 203), ML-DSA-44/65/87 (FIPS 204), FN-DSA-512/1024 (FIPS 206), SLH-DSA-128s (FIPS 205)

---

## Policy-as-Code

Three Rego policies ship with Agent 6 at `policies/rego/quantum/`:

| File | Package | Coverage |
|------|---------|----------|
| `quantum_crypto_policy.rego` | `securewatch.quantum.crypto` | Algorithm classification (deny RSA <2048, MD5, SHA-1; warn RSA/ECC; pass PQC) |
| `quantum_tls_policy.rego` | `securewatch.quantum.tls` | TLS version (deny 1.0/1.1; warn 1.2 RSA/ECC; warn public non-PQC) |
| `quantum_vendor_readiness_policy.rego` | `securewatch.quantum.vendor` | Vendor PQC status (deny no_roadmap on critical; warn unknown; pass supported) |

Each policy returns a `results` set with `policy_id`, `severity`, `passed`, `message`, and `remediation`.

---

## Compliance Framework Mappings

| Framework | Controls |
|-----------|---------|
| NIST SP 800-131A | SC-13 |
| NIST SP 800-208 | PQC-1 |
| NIST IR 8413 | HNDL-1 (harvest-now) |
| CMMC 2.0 | SC.3.177 |
| HIPAA | 164.312(a)(2)(iv) |
| SOC 2 | CC6.1 |
| ISO 27001:2022 | A.8.24 |
| PCI DSS v4.0 | 4.2.1, 3.5.1 |
| FedRAMP | SC-13 |
| NIST SP 800-52 | TLS version |

---

## Database Tables

Migration: `supabase/migrations/20260428210000_create_agent6_quantum_tables.sql`

| Table | Purpose |
|-------|---------|
| `quantum_crypto_inventory` | One row per discovered crypto asset |
| `quantum_readiness_assessments` | Aggregate score per client/scan |
| `quantum_remediation_tasks` | Actionable remediation items |
| `quantum_policy_results` | Per-asset policy pass/fail records |

All tables have RLS enabled. See migration for TODO notes on org-membership integration.

---

## Usage

```typescript
import { scanFindings } from "@/agents/agent6-quantum-readiness/cryptoInventoryScanner";
import { calculateQuantumReadinessScore } from "@/agents/agent6-quantum-readiness/quantumReadinessScoring";
import { buildRemediationPlan } from "@/agents/agent6-quantum-readiness/remediationPlanner";
import { evaluatePolicies, mapToFrameworkControls } from "@/agents/agent6-quantum-readiness/policyMapper";

// 1. Discover and enrich crypto assets from scan findings
const items = scanFindings(rawFindings, clientId, scanId);

// 2. Score
const assessment = calculateQuantumReadinessScore(items, clientId, scanId);

// 3. Remediation plan
const tasks = buildRemediationPlan(items, clientId, assessment.id);

// 4. Policy evaluation + control mapping
const policyResults = evaluatePolicies(items, clientId);
const controlMappings = mapToFrameworkControls(items, ["NIST SP 800-131A", "SOC 2"]);
```

---

## Design Principles

- **No client-specific data** — all configuration is passed as parameters; the module is reusable across MSP tenants
- **Immutable analysis** — `analyzeQuantumRisk()` returns a new object and never mutates input
- **Graceful degradation** — unknown algorithms receive a conservative `high` risk rating rather than throwing
- **Cryptographic agility** — algorithm profiles are data-driven; adding new PQC or deprecated algorithms requires only a new entry in the database object
