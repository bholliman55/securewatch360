# SecureWatch360 — ElevenLabs Voice Layer Build Log

> Chronological summary of the work completed in the voice-layer build session. Captures the user requests, the files created or modified, design decisions, error fixes, and verification results so the work can be reproduced or resumed without re-reading the entire chat.
>
> This is a synthesized session log, not a verbatim transcript. Where the user's prompt is reproduced, it is paraphrased to capture the intent and constraints; the tool calls themselves and their full outputs are not reproduced. The full transcript lives at `agent-transcripts/61d0ae35-c96b-4dac-bdcc-440142c558f3/61d0ae35-c96b-4dac-bdcc-440142c558f3.jsonl`.

## Table of contents

- [Pre-voice cleanup](#pre-voice-cleanup) — Markdown lint sweep + UI inline-style refactors
- [1. Voice Gateway foundation](#1-voice-gateway-foundation)
- [2. Supabase voice tables + repository](#2-supabase-voice-tables--repository)
- [3. Voice command router → existing agents](#3-voice-command-router--existing-agents)
- [4. Voice confirmation system](#4-voice-confirmation-system)
- [5. ElevenLabs webhook endpoint](#5-elevenlabs-webhook-endpoint)
- [6. Outbound incident-call helper](#6-outbound-incident-call-helper)
- [7. Voice-layer QA harness (`npm run qa:voice`)](#7-voice-layer-qa-harness-npm-run-qavoice)
- [8. Voice Command Center UI](#8-voice-command-center-ui)
- [9. ElevenLabs agent system instructions](#9-elevenlabs-agent-system-instructions)
- [10. README — ElevenLabs Voice Layer section](#10-readme--elevenlabs-voice-layer-section)
- [Final verification](#final-verification)
- [File index](#file-index)

---

## Pre-voice cleanup

Before the voice work started, the user fixed a series of `markdownlint` warnings (`MD022`, `MD032`, `MD036`, `MD040`, `MD060`) across `README.md` and `src/agents/agent6-quantum-readiness/README.md`, and refactored several React inline styles into CSS-variable patterns to satisfy the project's "no inline styles" rule. The standard pattern adopted was:

```tsx
<div
  ref={(el) => {
    if (el) el.style.setProperty('--bar-width', `${pct}%`);
  }}
  className="w-[var(--bar-width)] ..."
/>
```

Files touched in that pass:

- `ui/src/components/SecurityPosture.tsx`
- `ui/src/components/Training.tsx`
- `ui/src/components/Analytics.tsx` (extracted `AXIS_TICK` and `TOOLTIP_CONTENT_STYLE` constants)
- `ui/src/components/SimulationDashboard.tsx` (hoisted animation literals to module-level constants)
- `src/components/vendor-risk/VendorRiskCard.tsx`
- `src/components/compliance/GapAnalysisHeatmap.tsx`
- `src/components/onboarding/OnboardingWizard.tsx`

---

## 1. Voice Gateway foundation

**User request:** Build the secure server-side gateway that ElevenLabs will call. Validate request, classify intent, gate by safety + role, route to agents, and write a complete audit log. Honor a fixed intent set, four safety levels (`READ_ONLY`, `LOW_RISK_ACTION`, `HIGH_RISK_ACTION`, `DESTRUCTIVE_ACTION`), and never expose webhook URLs / API keys / agent secrets.

**Files created:**

| File | Purpose |
| --- | --- |
| `src/server/voice/types.ts` | Closed `VoiceIntent` enum, `CommandSafetyLevel`, `VOICE_INTENT_METADATA`, request/response shapes |
| `src/server/voice/voiceIntentClassifier.ts` | Deterministic regex classifier with priority-ordered `IntentRule[]` and slot extractors (`DOMAIN_RE`, `ENDPOINT_ID_RE`, `USER_ID_RE`, `FRAMEWORK_RE`, `SEVERITY_RE`) |
| `src/server/voice/voicePolicyGuard.ts` | `evaluateVoicePolicy()` returns `{ decision: "allow" \| "needs_confirmation" \| "denied", reason }` based on safety level, role, confirmation flag, and classifier confidence |
| `src/server/voice/voiceCommandRouter.ts` | Maps classified commands → Inngest events (later refactored to delegate to `VOICE_ADAPTERS`) |
| `src/server/voice/voiceAuditLogger.ts` | `logVoiceCommandReceived` + `logVoiceCommandResolved` write to **both** `audit_logs` (cross-cutting) and `voice_audit_events` (voice-specific) |
| `src/server/voice/voiceGateway.ts` | The single public entry point: classify → audit-received → policy → route → audit-resolved. Never throws to the caller |
| `src/server/voice/__tests__/voiceGateway.test.ts` | Per-intent classification + safety + routing + denied/allow paths |

**Key design decisions:**

- **Closed intent set.** `VOICE_INTENTS` is a `readonly tuple as const` so the classifier can never coerce an arbitrary string into a privileged action.
- **Audit twice per command.** One row on receipt, one on resolution. Forensic review never has to reconstruct "did the gateway *see* this?" from inference.
- **Deterministic only.** No LLM in the policy or routing path (matches the project's V4 engineering guardrail).
- **Tenant + role come from the caller.** The gateway re-uses whatever `requireTenantAccess` / `dynamic_variables` resolves; it never re-derives auth from cookies.

---

## 2. Supabase voice tables + repository

**User request:** Add a migration for `voice_sessions`, `voice_commands`, `voice_audit_events`, and `voice_confirmation_requests` with the exact column shapes provided, indexes on `client_id` / `user_id` / `elevenlabs_conversation_id` / `intent` / `status` / `created_at`, RLS aligned with the existing tenant model, plus a TypeScript repository helper.

**Files created:**

- `supabase/migrations/20260508130000_create_voice_tables.sql`
- `src/server/voice/voiceRepository.ts`
- `src/server/voice/__tests__/voiceRepository.test.ts`

**Schema highlights:**

```sql
voice_sessions(
  id uuid pk default gen_random_uuid(),
  client_id uuid null,                       -- nullable so anonymous calls
  user_id uuid null,                         --   can be backfilled later
  elevenlabs_conversation_id text null,
  channel text default 'elevenlabs',
  status text default 'active',
  started_at timestamptz default now(),
  ended_at timestamptz null,
  metadata jsonb default '{}'::jsonb
)

voice_commands(
  id uuid pk,
  voice_session_id uuid references voice_sessions,
  client_id uuid, user_id uuid,
  raw_transcript text not null,
  intent text not null, safety_level text not null,
  status text default 'received',            -- received | awaiting_confirmation
                                             --   | denied | executed | failed
                                             --   | clarification_requested
  requires_confirmation bool default false,
  confirmed_at, executed_at timestamptz null,
  result_summary, error_message text null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
)

voice_audit_events(...)         -- mirrors audit_logs but voice-scoped
voice_confirmation_requests(    -- 5-min TTL phrase challenges
  id uuid pk, voice_command_id uuid,
  confirmation_phrase text, status text default 'pending',
  expires_at timestamptz not null
)
```

**Repository contract (`VoiceRepository`):**

```ts
insertSession, findVoiceSessionByConversationId,
insertCommand, getVoiceCommand, updateCommandStatus,
insertAuditEvent,
insertConfirmationRequest,
findLatestPendingConfirmationBundle,   // joins command + confirmation
updateConfirmationRequestStatus
```

`InsertVoiceCommandInput.id` is optional so the gateway can pass its `voiceCommandId` through and keep the audit-logged ID identical to the row PK. RLS policies are scoped on `client_id` and skip enforcement when `client_id IS NULL` (early sessions).

---

## 3. Voice command router → existing agents

**User request:** Wire each intent to existing internal functions or create clean adapter stubs. Each adapter must return `{ success, spokenSummary, data?, nextActions?, requiresFollowUp? }`. Tests for every intent route.

**Files created (`src/server/voice/agentAdapters/`):**

| File | Intent(s) | Dispatch |
| --- | --- | --- |
| `types.ts` | shared types (`AdapterInngestEvent`, `VoiceAdapterContext`, `AdapterResult`, `VoiceAdapter`) | — |
| `shared.ts` | `resolveInngestSend`, `resolveNewId`, `makeEvents` | mocking hooks |
| `scannerAdapter.ts` | `RUN_EXTERNAL_SCAN` | `securewatch/agent1.external_discovery.requested` + `agent2.osint_collection.requested` |
| `vulnerabilityAdapter.ts` | `RUN_VULNERABILITY_SCAN` | `securewatch/agent2.scan.requested` |
| `complianceAdapter.ts` | `CHECK_COMPLIANCE_STATUS`, `SHOW_CRITICAL_FINDINGS`, `SUMMARIZE_CLIENT_RISK` | direct service calls (`runComplianceStatus`, `runRiskQuery`) so the speaker hears live data the same turn |
| `reportAdapter.ts` | `GENERATE_EXECUTIVE_REPORT` | `securewatch/threat.digest.requested` |
| `incidentResponseAdapter.ts` | `START_INCIDENT_RESPONSE`, `ISOLATE_ENDPOINT`, `DISABLE_USER_ACCOUNT` | `securewatch/monitoring.alert.received` or `securewatch/remediation.execution.requested` (with `executionKind: "isolate_endpoint"` / `"disable_user_account"`) |
| `remediationTicketAdapter.ts` | `CREATE_REMEDIATION_TICKET` | reads `getIntegrationConfig` for Jira/ServiceNow; tags `targetConnector: "jira" \| "servicenow" \| "stub"` |
| `index.ts` | `VOICE_ADAPTERS` registry — closed map of `VoiceIntent → VoiceAdapter` (including `UNKNOWN`) | — |

**Router refactor:** `voiceCommandRouter.ts` was simplified to a thin shell that builds `VoiceAdapterContext`, dispatches through the registry, and translates the unified `AdapterResult` back into the existing `RouteResult` shape. `RouterDeps.augmentContext` lets tests inject mocked services without monkey-patching imports.

**Test file:** `src/server/voice/agentAdapters/__tests__/adapters.test.ts` — 19 tests covering every intent, slot validation, ticket connector fallback, and read-only-vs-Inngest dispatch.

---

## 4. Voice confirmation system

**User request:** When a user says *"Isolate endpoint LAPTOP-123"* or *"Disable Sarah's account"*, do not execute. Respond with the canonical phrase to confirm, expire after 5 minutes, match phrases case-insensitively, scope to the same user/session, and require admin role for destructive confirmations.

**Files created:**

- `src/server/voice/voiceConfirmationService.ts`
- `src/server/voice/__tests__/voiceConfirmationService.test.ts`

**Public API:**

```ts
VOICE_CONFIRMATION_TTL_SECONDS = 5 * 60

normalizeConfirmationPhrase()
buildNormalizedConfirmationPhrase(classified)   // stored, lowercased
buildDisplayConfirmationPhrase(classified)      // spoken with casing
buildConfirmationSpokenPrompt(classified)       // full "Say: ..." line
isConfirmationFollowUpTranscript(transcript)    // /^\s*confirm\b/i

persistConfirmationChallenge(input, deps)
  → inserts voice_commands row in `awaiting_confirmation`
  → inserts voice_confirmation_requests row with 5-min TTL
  → emits voice.confirmation.requested

tryResolveConfirmationFollowUp(input, deps)
  → finds pending bundle for this tenant + user + conversation
  → expired → status "expired", emits voice.confirmation.expired
  → wrong phrase → status "rejected", emits voice.confirmation.rejected
  → destructive + non-admin → rejected (admin role re-check)
  → valid → re-evaluates policy (with confirmation: true), routes through
            adapter, marks "confirmed"/"executed", emits .accepted
  → catches dispatch errors → marks "failed" + audit
```

The gateway's main entry point gained a top-level branch: if the transcript starts with `confirm`, run `tryResolveConfirmationFollowUp` first; otherwise classify normally.

**Repository extensions** added in this step: `getVoiceCommand`, `findLatestPendingConfirmationBundle`, `updateConfirmationRequestStatus`. The expiry filter was deliberately moved out of the SQL query into the service so the service can emit the `expired` audit event explicitly.

---

## 5. ElevenLabs webhook endpoint

**User request:** Receive ElevenLabs post-call and tool-call events, validate the signature, return HTTP 200 fast, persist the safe payload, and dispatch transcripts into `handleVoiceCommand`. Tests for valid webhook, invalid signature, missing transcript, unknown event type, and duplicate conversation handling.

**Files created (`src/server/api/elevenlabs/`):**

- `types.ts` — `ElevenLabsEventType`, `ElevenLabsDynamicVariables`, `ElevenLabsCallData`, `ElevenLabsToolCallData`, `ParsedElevenLabsEvent`, `ElevenLabsWebhookResponseBody`
- `verifySignature.ts` — `verifyElevenLabsSignature` parses `t=<unix>,v0=<hex>`, recomputes HMAC-SHA256(`"{t}.{rawBody}"`), `timingSafeEqual` compare, ±30-min replay window
- `webhook.ts` — `handleElevenLabsWebhook(request, deps)` Next.js App-Router-compatible handler
- `__tests__/webhook.test.ts` — 12 cases (method gating, valid post-call, no-secret skip, invalid signature, missing header, missing transcript, unknown event, duplicate conversation, tool-call under existing conversation, missing tenant context, secret hygiene, fake-timer signature)

**Handler pipeline:**

1. Method gate → `405` for non-POST
2. Read env at call time (`ELEVENLABS_WEBHOOK_SECRET`, `ELEVENLABS_DEFAULT_TENANT_ID/USER_ID/USER_ROLE`, `ELEVENLABS_AGENT_ID`)
3. Verify signature when secret is configured. Failures → `401 invalid_signature` with audit (no secret echo)
4. Parse JSON body; failures → `400 invalid_payload`
5. Normalize → `ParsedElevenLabsEvent` (resolves tenant/user/role from `dynamic_variables` first, env defaults second)
6. Find/insert `voice_sessions` row, then **always** insert a `voice_audit_events` row with the full safe payload
7. Decide dispatch:
   - `unknown` / `post_call_audio` / `call_initiation_failure` → `ignored` / `accepted`
   - empty transcript → `ignored`
   - missing tenant context → `400 invalid_payload`
   - duplicate post-call (existing session, type ≠ `tool_call`) → `duplicate`
   - tool-call events → **always** dispatched (mid-conversation new requests)
8. Call `handleVoiceCommand` inside try/catch; errors → `200 error` (so ElevenLabs does not retry-storm)

**Header redaction.** `safeAudit` coerces `null` tenantId to empty string so audit insert succeeds even pre-validation, and never logs the API key, signature header, or any secret.

---

## 6. Outbound incident-call helper

**User request:** A helper SecureWatch360 can call to dial an MSP owner during a critical incident and speak a short briefing. Use the ElevenLabs Twilio outbound-call endpoint. Severity gate, dry-run mode, audit event `OUTBOUND_INCIDENT_CALL_STARTED`, and tests.

**Files created:**

- `src/server/voice/elevenlabsClient.ts` — thin HTTP client for `POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call`. Returns a discriminated union (`ok: true | false`), categorized failure reasons, injectable `fetch`, 10s `AbortController` timeout
- `src/server/voice/outboundIncidentCallService.ts` — domain orchestrator: `startOutboundIncidentCall({ clientId, incidentId, toNumber, briefingText, severity })`
- `src/server/voice/__tests__/outboundIncidentCallService.test.ts` — 10 tests

**Pipeline:**

1. **Severity gate** — `severity !== "critical"` short-circuits with `{ ok: true, skipped: true, reason: "severity_below_threshold" }` unless `force: true`
2. **Config validation** — when not in dry-run, missing `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` / `ELEVENLABS_PHONE_NUMBER_ID` returns a typed failure and audits `OUTBOUND_INCIDENT_CALL_FAILED`
3. **Dry-run** — `VOICE_CALLS_DRY_RUN=true` (or `dryRun: true`) generates synthetic `dry-run-conv-…`/`dry-run-call-…` IDs, skips HTTP, but **still** creates a `voice_sessions` row tagged `channel="elevenlabs-outbound-dry-run"` and a full audit event
4. **Dispatch** — POST through the client. Failure path → `{ ok: false, reason: "elevenlabs_error" }` with FAILED audit on both surfaces; no session row
5. **Persist** — on success, insert `voice_sessions` with `metadata.{conversationId, callSid, incidentId, severity, dryRun, briefingTextLength, toNumberMasked}`
6. **Audit** — `OUTBOUND_INCIDENT_CALL_STARTED` written to **both** `audit_logs` (entity_type `incident_response`) and `voice_audit_events` (forensic raw response body)
7. Phone numbers are masked (`+1•••••0199`); API key is never serialized

The helper never throws to the caller — every failure mode comes back as `{ ok: false, reason }` so the incident workflow can fall back to email/SMS without crashing.

---

## 7. Voice-layer QA harness (`npm run qa:voice`)

**User request:** A QA script that exercises the full voice layer end-to-end **without** calling ElevenLabs. Six scenarios with explicit pass/fail. Exit 1 on any failure. `package.json` script `qa:voice`.

**File created:** `scripts/qa/voice-layer-qa.ts`

**Strategy:**

1. Pre-import env priming so `getSupabaseAdminClient()` can construct a never-used client
2. `globalThis.fetch` interceptor swallows Supabase REST writes (returns 201) so `writeAuditLog` succeeds quietly
3. Singleton `voiceRepository` patched with in-memory recorders for sessions, commands, confirmations, and audit events
4. In-memory `RouterDeps` captures Inngest events instead of dispatching; `augmentContext` injects mocked compliance/risk services

**Six cases (all pass):**

| # | Transcript | Verifies |
| --- | --- | --- |
| 1 | "Run an external scan for Acme Dental acmedental.com" | `RUN_EXTERNAL_SCAN`, safety in `{READ_ONLY, LOW_RISK_ACTION}`, no confirm, audit ≥2, discovery event dispatched |
| 2 | "Show me critical findings for Acme Dental" | `SHOW_CRITICAL_FINDINGS`, `READ_ONLY`, no confirm, audit ≥2, spoken response references findings |
| 3 | "Generate an executive report for Acme Dental" | `GENERATE_EXECUTIVE_REPORT`, no confirm, audit ≥2, report event dispatched |
| 4 | "Isolate endpoint LAPTOP-123" | `ISOLATE_ENDPOINT`, `needs_confirmation`, command stored as `awaiting_confirmation`, **no** isolation event dispatched yet, `voice.confirmation.requested` audit emitted, prompt contains `confirm isolate endpoint LAPTOP-123` |
| 5 | "Confirm isolate endpoint LAPTOP-123" (admin) | Status `executed`, `voice.confirmation.accepted` audit, isolation event dispatched on confirm |
| 6 | "Disable Sarah's account" | Non-admin (analyst) → `denied`; admin → `needs_confirmation`; safety `DESTRUCTIVE_ACTION`; follow-up prompt warns destructive |

Output: color-coded pass/fail table per case, plus aggregate counts (audit events, Inngest events, Supabase REST hits intercepted).

**Classifier fix surfaced by QA.** Case 6's exact phrasing `"Disable Sarah's account"` initially classified as `UNKNOWN` because the existing pattern only matched `disable [user('s)] account`. Two minimal additions to `voiceIntentClassifier.ts`:

```ts
// New pattern (additive)
/\b(?:disable|lock|suspend)\s+(?:the\s+)?[a-z][\w.-]*'s\s+account\b/i

// New possessive slot fallback
const POSSESSIVE_USER_RE =
  /\b(?:disable|lock|suspend)\s+(?:the\s+)?([a-z][\w.-]*)'s\s+account\b/i;
```

`POSSESSIVE_USER_RE` is only consulted when `USER_ID_RE` doesn't already pull a stronger identifier (email/UUID). All 90 unit tests stayed green.

**`package.json`:** `"qa:voice": "npx tsx scripts/qa/voice-layer-qa.ts"`

---

## 8. Voice Command Center UI

**User request:** Four pure server components under `src/components/voice/` that present the voice operating layer cleanly — voice status, examples, pipeline timeline, guardrails panel — without animations or mascots.

**Files created:**

- `src/components/voice/VoiceCommandExamples.tsx` — five canonical example utterances (`Run an external scan…`, `Show me critical findings`, `Is Acme Dental CMMC ready?`, `Generate an executive report…`, `Start incident response…`) with intent label and safety badge per row
- `src/components/voice/VoiceCommandPermissionsPanel.tsx` — checklist of the four guardrails plus an explicit "every voice action is audited" row, each with a contextual badge (`always allowed`, `analyst+`, `needs confirmation`, `admin only`, `no exceptions`)
- `src/components/voice/VoiceCommandTimeline.tsx` — vertical 7-stage timeline (`transcript_received → intent_classified → permission_checked → confirmation_requested → agent_started → result_returned → audit_logged`); per-stage status `pending | in_progress | done | skipped | failed`
- `src/components/voice/VoiceCommandCenter.tsx` — composition surface. 4-cell status grid (`ElevenLabs`, `Active session`, `Last command`, `Current action`), then a 2-up grid of examples + guardrails on `lg+`, then the timeline. `EMPTY_VOICE_COMMAND_CENTER_STATE` exported for static rendering

**Public state contract:**

```ts
VoiceCommandCenterState = {
  connection: { connected, agentId?, lastCheckedAt? }
  session:    { active, conversationId?, startedAt?, channel? }
  lastCommand?: { transcript?, intent?, safetyLevel?, status?, at? }
  currentAction?: { label?, spokenResponse? }
  timeline?: VoiceTimelineStage[]
}
```

Agent IDs are masked to last 6 chars; conversation IDs middle-truncated; spoken responses truncated at 80 chars. No `"use client"`; pure server components matching the existing `src/components/` design system (rounded-xl cards, gray-200 borders, soft shadow, neutral palette accented with emerald/sky/amber/rose for state).

---

## 9. ElevenLabs agent system instructions

**User request:** The system prompt for the ElevenLabs Conversational AI agent. Calm cyber ops assistant; brief; never invent results; route through the webhook; example tool-call payloads.

**File created:** `docs/elevenlabs/securewatch360-agent-instructions.md`

Sections:

- Role and tone (calm, brief, no secrets)
- Ground truth and honesty (never claim completion without backend confirmation)
- Client and asset confirmation (one clarifying question)
- Risk and confirmation table (read-only / risky / destructive / unclear)
- Allowed phrasing examples
- Disallowed phrasing
- Tool usage — references `data.parameters.transcript`, `data.parameters.confirmation`, and `data.metadata.dynamic_variables.{tenant_id, user_id, user_role}`
- Three example payloads:
  - `tool_call` standard command
  - `tool_call` with `"confirmation": true` follow-up
  - `post_call_transcription` envelope with transcript array

The tool name in examples is `securewatch_voice_command`; the webhook reads `parameters.transcript` regardless.

---

## 10. README — ElevenLabs Voice Layer section

**User request:** Add a top-level Voice Layer section to `README.md` with required env vars, 7-step local setup, security notes, and 5-case troubleshooting.

**Insertion point:** Between `Feature Layer (v5+)` and `Infrastructure as Code`.

**Sections:**

- **Required environment variables** — the 5 spec'd vars plus 3 optional dev defaults (`ELEVENLABS_DEFAULT_TENANT_ID`, `ELEVENLABS_DEFAULT_USER_ID`, `ELEVENLABS_DEFAULT_USER_ROLE`)
- **Local setup** — 7 ordered steps (env → migration → dev server + Inngest → ElevenLabs webhook URL → `npm run qa:voice` → read-only test → confirmation flow test)
- **Security notes** — RBAC enforcement, no secret echo, destructive-action confirmation, two-row audit per command, keep dry-run on until creds verified
- **Troubleshooting** (5 `####` subheadings):
  - Webhook returns 401 (signature, replay window, dev override)
  - Missing transcript ("ignored")
  - ElevenLabs API key invalid
  - Outbound call disabled (severity gate vs missing config)
  - Command classified as UNKNOWN (QA harness as regression check)

**Lint state.** Five `MD036/no-emphasis-as-heading` warnings I introduced (from `**Bold**` troubleshooting labels) were converted to `####` headings. Remaining 21 lint warnings are pre-existing in untouched parts of the README.

---

## Final verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx vitest run` (whole project) | **275 / 275 pass** across 36 files |
| `npx vitest run src/server/voice src/server/api/elevenlabs` | **102 / 102 pass** across 6 files |
| `npm run qa:voice` | **6 / 6 pass**, exit 0 |
| `next lint` on new files | no errors |
| `ReadLints` on `src/components/voice/` | no errors |
| `ReadLints` on `README.md` | only pre-existing warnings remain |

---

## File index

### Server / domain layer

```text
src/server/voice/
  types.ts
  voiceIntentClassifier.ts
  voicePolicyGuard.ts
  voiceCommandRouter.ts
  voiceAuditLogger.ts
  voiceGateway.ts
  voiceRepository.ts
  voiceConfirmationService.ts
  elevenlabsClient.ts
  outboundIncidentCallService.ts
  agentAdapters/
    types.ts
    shared.ts
    scannerAdapter.ts
    vulnerabilityAdapter.ts
    complianceAdapter.ts
    reportAdapter.ts
    incidentResponseAdapter.ts
    remediationTicketAdapter.ts
    index.ts
    __tests__/adapters.test.ts
  __tests__/
    voiceGateway.test.ts
    voiceRepository.test.ts
    voiceConfirmationService.test.ts
    outboundIncidentCallService.test.ts

src/server/api/elevenlabs/
  types.ts
  verifySignature.ts
  webhook.ts
  __tests__/webhook.test.ts
```

### UI

```text
src/components/voice/
  VoiceCommandExamples.tsx
  VoiceCommandPermissionsPanel.tsx
  VoiceCommandTimeline.tsx
  VoiceCommandCenter.tsx
```

### Database

```text
supabase/migrations/20260508130000_create_voice_tables.sql
```

### QA + scripts

```text
scripts/qa/voice-layer-qa.ts
package.json   # added "qa:voice"
```

### Docs

```text
docs/elevenlabs/securewatch360-agent-instructions.md
docs/elevenlabs/voice-layer-build-log.md   # this file
README.md      # new "ElevenLabs Voice Layer" section
```
