# SecureWatch360 Security Review — 2026-04-30

## Summary

Manual security review of all service layer, API routes, and integration code. Findings and resolutions documented below.

## Fixed Issues

### CRITICAL — Command Injection in remediationExecution.ts

**Before:** `exec(commandTemplate)` passed user-controlled values directly to the shell.

**After:** `execFile()` with `parseCommandTemplate()` that:
1. Validates all template substitution values against `SAFE_VALUE_RE` (`/^[a-zA-Z0-9._\-:/]{1,256}$/`)
2. Splits the command into `[executable, ...args]` before calling `execFile` — no shell interpretation
3. Throws immediately if any template value contains shell metacharacters

**Tests:** `src/__tests__/remediationExecution.security.test.ts` — 18 injection tests

---

### HIGH — Demo Tenant Bypass Too Permissive

**Before:** `isDemoTenantBypassEnabled` checked `NODE_ENV !== "production"` and `INNGEST_DEV=1` — insufficient because staging often runs `NODE_ENV=production`.

**After:** Requires all three guards simultaneously:
- `NODE_ENV !== "production"`
- `INNGEST_DEV=1`
- `ALLOW_DEMO_TENANT_BYPASS=1` (new explicit opt-in flag)

Add `ALLOW_DEMO_TENANT_BYPASS=1` to `.env.local` for local development only.

---

### HIGH — IDOR via Missing tenant_id on Update Queries

**Files fixed:** `risk-exceptions/[id]/approve/route.ts`, `risk-exceptions/[id]/reject/route.ts`

Added `.eq("tenant_id", existing.tenant_id)` to all update queries as defense-in-depth. Even though auth is checked before the update, the double-key constraint ensures a race condition or middleware bypass cannot update records across tenants.

---

### HIGH — BrightData Credentials in Error Messages

Error messages in `brightDataClient.ts` no longer include the proxy URL or zone names, which could expose credential context in logs.

---

## Remaining Recommendations (Not Yet Fixed)

### Evidence Export — Excessive Data Exposure

`GET /api/compliance/evidence-export` returns up to 500 policy decisions and 5000 audit log entries with full payloads. Recommendation for future work:
- Restrict full payload export to `owner` role only
- Add per-export audit log entry flagging large exports
- Default date range to 90 days

### RLS Verification

Row-Level Security policies on Supabase enforce tenant isolation at the database layer. All API routes use `getSupabaseAdminClient()` server-side and scope queries with explicit `.eq("tenant_id", tenantId)`. Verify RLS is also enforced on `tenant_users`, `findings`, `remediation_actions`, and `audit_logs` tables with the service role key as a secondary defense.

### Auth-Before-Data Pattern

For routes where tenant_id must be resolved from the database (e.g., `incidents/[id]`), data is fetched before auth is checked. The data fetch uses admin client and is scoped to ID only — existence leakage is minimal but present. Future refactor: extract tenant_id from URL path parameters instead of database lookup.

## BrightData MCP Integration

The current BrightData integration uses the HTTP proxy API directly (`src/integrations/brightdata/brightDataClient.ts`). To switch to the BrightData MCP server:

1. Install the BrightData MCP server: `npx @brightdata/mcp`
2. Add to `.claude/settings.json` under `mcpServers`
3. Replace `BrightDataClient` calls in `BrightDataAcquisitionProvider` with MCP tool calls (`mcp__brightdata__scrape_url`, etc.)

The HTTP proxy approach is fully functional and the two are interchangeable — MCP provides a simpler auth model (API key only, no zone config needed).

## Test Coverage

| File | Tests | Coverage Area |
|------|-------|---------------|
| `decisionEngine.test.ts` | 15 | All policy rules, action ordering |
| `policyPrecedence.test.ts` | 11 | Merge logic, block/escalate precedence |
| `integrationHub.test.ts` | 9 | Jira/ServiceNow sync, error paths |
| `threatDigestGenerator.test.ts` | 6 | Claude integration, fallback, aggregation |
| `evidencePdfRenderer.test.ts` | 13 | HTML rendering, XSS escaping |
| `brightDataClient.test.ts` | 8 | HTTP fetch, retry, link extraction |
| `remediationExecution.security.test.ts` | 13 | Injection prevention |
| **Total** | **75** | |
