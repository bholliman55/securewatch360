# SecureWatch360 ↔ `api_mw_connector` integration

The middleware repo (`c:\users\brent\source\api_mw_connector`) should treat SecureWatch360 as the **system of record** for normalized security outcomes, while the connector owns **vendor auth, pagination, retries, and field mapping**.

This document describes **policy pack** and **catalog** HTTP surfaces that are safe to call from automation when machine credentials are configured.

## Authentication

### Browser / interactive (default)

Policy routes use the normal Next.js session (`getCurrentUser`) plus `tenant_users` membership (`requireTenantAccess`).

### Machine / connector (optional)

When these environment variables are set on the SecureWatch360 app:

- `POLICY_PACK_EXPORT_TOKEN` — shared secret (use a long random value).
- `POLICY_PACK_EXPORT_TENANT_IDS` — comma-separated UUID allowlist of tenants the token may access.

Send on each request:

```http
Authorization: Bearer <POLICY_PACK_EXPORT_TOKEN>
```

The token is only accepted if `tenantId` (query param) is in `POLICY_PACK_EXPORT_TENANT_IDS`. If the allowlist is empty, machine auth is **disabled** (fail closed).

## Endpoints

Base URL: your deployed Next origin (e.g. `https://sw360.example.com`).

| Purpose | Method | Path |
|--------|--------|------|
| Full catalog (JSON) | GET | `/api/policy/catalog?tenantId=<uuid>&framework=<optional>` |
| Terraform stub | GET | `/api/policy/export/terraform?tenantId=<uuid>&framework=<optional>&download=1` |
| Ansible stub | GET | `/api/policy/export/ansible?tenantId=<uuid>&framework=<optional>&download=1` |
| JSON manifest (for ETL / connector cache) | GET | `/api/policy/export/manifest?tenantId=<uuid>&framework=<optional>&download=1` |

`framework` filters to one catalog profile (e.g. `SOC2`, `NIST`). Omit for all frameworks.

## Manifest schema (`/api/policy/export/manifest`)

Top-level JSON:

- `kind`: `"securewatch360.policy_pack_manifest"`
- `version`: `1` (integer; bump when shape changes)
- `generatedAt`: ISO-8601 timestamp
- `frameworks`: array of `{ frameworkCode, controlCount, controls[] }`
- Each control: `controlCode`, `title`, `body`, `enforcementMode`, `terraformModule`, `ansibleRole`

The connector can:

1. Poll manifest on a schedule and diff by `(frameworkCode, controlCode)` + `generatedAt`.
2. Map `terraformModule` / `ansibleRole` to customer-specific module paths in the connector config.
3. Push normalized rows into customer CMDB or ticket systems without touching vendor SDKs inside SecureWatch360.

## Findings and scans (outside this doc)

For **findings**, **CVE links**, and **scan runs**, prefer:

- Direct Supabase ingestion using service role **only inside trusted infrastructure**, or
- A dedicated `POST /api/integrations/...` ingest route (add when you define the canonical finding payload with idempotency keys).

Do not embed vendor API keys in the SecureWatch360 browser bundle.
