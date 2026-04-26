# OPA in Docker — Step-by-step setup (SecureWatch360 v4)

This guide walks you through running **Open Policy Agent (OPA)** in Docker so SecureWatch360 can call it for v4 decisioning, with a safe **TypeScript rules fallback** when OPA is down.

---

## What you need first

1. **Docker Desktop** (Windows) or Docker Engine + Compose on Linux/macOS, installed and running.
2. **This repository** cloned locally, e.g. `c:\Users\brent\source\securewatch360`.
3. A terminal **at the repository root** (the folder that contains `policies/rego` and `package.json`).

---

## Step 1 — Pick how you want to run OPA

| Mode | Use when |
|------|----------|
| **A. Quick smoke test** | You only need port `8181` up; you are not testing repo Rego yet. |
| **B. Repo policies mounted** | You want SecureWatch360 + sample policies under `policies/rego` (recommended for real dev). |

---

## Step 2A — Run OPA (quick smoke test, no policies)

From the repo root:

```bash
docker run -p 8181:8181 openpolicyagent/opa run --server --addr :8181
```

- **What this does:** starts OPA listening on `http://localhost:8181`.
- **Limitation:** no `policies/rego` files are loaded unless you mount them (use Step 2B for that).

Leave this terminal open while you develop. To stop: press `Ctrl+C` in that terminal (or stop the container from Docker Desktop).

---

## Step 2B — Run OPA with this repo’s Rego policies (recommended)

### On macOS / Linux / Git Bash

From the repo root:

```bash
docker run --rm -p 8181:8181 -v "$PWD/policies/rego:/policies" openpolicyagent/opa:latest run --server --addr :8181 /policies
```

### On Windows PowerShell

From the repo root (replace the drive/path if yours differs):

```powershell
docker run --rm -p 8181:8181 -v "${PWD}\policies\rego:/policies" openpolicyagent/opa:latest run --server --addr :8181 /policies
```

If Docker reports a volume path error, use an **absolute** Windows path instead, for example:

```powershell
docker run --rm -p 8181:8181 -v "c:\Users\brent\source\securewatch360\policies\rego:/policies" openpolicyagent/opa:latest run --server --addr :8181 /policies
```

- **`--rm`:** removes the container when it stops (keeps your machine tidy).
- **`-v ...:/policies`:** mounts your local `policies/rego` into the container as `/policies`.
- **`/policies`:** tells OPA to load bundles/files from that directory.

---

## Step 3 — Verify OPA is healthy

In a **second** terminal (repo root is fine):

```bash
curl -s http://localhost:8181/health
```

You should see JSON and HTTP **200**. If you get **connection refused**, OPA is not listening on `8181` (container not running, wrong port, or firewall).

---

## Step 4 — Verify the decision API (matches SecureWatch360 defaults)

Default decision path in code is:

`/v1/data/securewatch/v4/decision`

Test it.

**macOS / Linux / Git Bash** (one line):

```bash
curl -s -X POST "http://localhost:8181/v1/data/securewatch/v4/decision" -H "Content-Type: application/json" -d '{"input":{"severity":"high","targetType":"server","exposure":"internet"}}'
```

**Windows PowerShell** (native; no `curl` quoting issues):

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8181/v1/data/securewatch/v4/decision" `
  -ContentType "application/json" `
  -Body '{"input":{"severity":"high","targetType":"server","exposure":"internet"}}'
```

You should get JSON with a **`result`** object shaped like `DecisionOutput` (`action`, `requiresApproval`, `autoRemediationAllowed`, `riskAcceptanceAllowed`, `reasonCodes`, `matchedPolicies`, optional `metadata`).

If `result` is **undefined** or `{}`, either policies are not mounted (Step 2B) or the Rego package/path does not match `OPA_POLICY_PATH`.

---

## Step 5 — Point SecureWatch360 at OPA

In `.env.local` (or your deployment env), set:

```bash
DECISION_ENGINE_PROVIDER=opa
OPA_BASE_URL=http://localhost:8181
# Optional; default in code matches the sample policy:
OPA_POLICY_PATH=/v1/data/securewatch/v4/decision
```

Restart `npm run dev` (and Inngest if you use it) after changing env vars.

**Note:** OPA runs **inside Docker** but listens on the host at `localhost:8181` because of `-p 8181:8181`. That is what `OPA_BASE_URL` should use from the Next.js process on the same machine.

---

## Step 6 — Confirm behavior with the QA script

With OPA running (Step 2B recommended):

```bash
npm run qa:opa-optional
```

This script checks:

1. Fallback when OPA is effectively offline (wrong port).
2. Live OPA when `http://localhost:8181` responds to `/health`.
3. Same `DecisionOutput` **shape** in both cases.

---

## Fallback behavior (why scans keep working)

If OPA is unreachable or returns an invalid decision:

- The **scan workflow does not crash** because `evaluateDecision` catches failures and falls back to in-repo TypeScript rules.
- You will see a **console warning** like: `[decision-engine] OPA unavailable, falling back to local rules`.
- Response metadata can include flags such as `sw360_decision_engine_fallback` so you can tell OPA was skipped.

---

## Sample policy in this repo

Local sample decision package:

- `policies/rego/securewatch360/v4_decision.rego`

It backs the default path: `securewatch/v4/decision` → URL path `/v1/data/securewatch/v4/decision`.

---

## Common troubleshooting

| Symptom | What to check |
|--------|----------------|
| `connection refused` on `:8181` | Container running? Port free? Try `docker ps`. |
| Volume mount fails on Windows | Use absolute path in `-v` (see Step 2B). |
| `result` is empty | Run Step 2B; confirm file is under `policies/rego` and OPA logs show no parse errors. |
| App always falls back | `OPA_BASE_URL` wrong; OPA not on same host network; `/health` fails. |
| Policy edits ignored | Restart OPA container after changing Rego files. |

---

## Optional: legacy adapter URL (`OPA_POLICY_EVAL_URL`)

Some deployments use a **custom HTTP adapter** that accepts `{ input, policies }`. That path is separate from direct OPA REST documented here. For local Docker OPA, use **`OPA_BASE_URL` + `OPA_POLICY_PATH`** as above.

For more platform context, see the main `README.md` (search for “OPA”).
