---
name: alert-dispatcher
description: Delivers outbound notifications across email, Slack, SMS, and webhooks using rendered content and escalation output. Implements the SecureWatch alert pipeline choke point — after deduplication, notification-cooldown (finding-based alerts), escalation-chain-resolver, and message-template-renderer. Use when sending alerts, wiring worker or app notification delivery, adding a channel adapter, confirming delivery status for cooldown bookkeeping, retrying failed sends, or mapping alert payloads to real transports.
---

# Alert Dispatcher

## Role

Fan out **one logical alert** to **many recipients × many channels**. This is the only place outbound sends should execute — agents must not call email/Slack/SMS APIs directly.

## Prerequisites (run in order)

1. **finding-based path**: `deduplication-checker` → **`notification-cooldown`** (`cooldown_passed: true`) → `escalation-chain-resolver` → `message-template-renderer`
2. **non-finding path** (thresholds, ops): skip cooldown if not tied to a stable `finding_id` → `escalation-chain-resolver` → `message-template-renderer`
3. If `queue_for_digest: true` or `dashboard_only: true` from escalation — **do not** call Alert Dispatcher for push channels; route to Digest Aggregator or dashboard persistence instead.

## Input

Merge these into one dispatch envelope:

```json
{
  "dispatch_id": "uuid-v4",
  "tenant_id": "uuid",
  "client_id": "string | null",
  "finding_id": "string | null",
  "correlation": {
    "workflow_execution_id": "string | null",
    "job_id": "uuid | null"
  },
  "rendered": { },
  "escalation": {
    "escalation_tier": "string",
    "recipients": [ ],
    "channels_active": ["email", "slack", "sms", "webhook"],
    "send_immediately": true
  },
  "channel_credentials": {
    "email_provider": "env_ref",
    "slack_webhook_url": "secret_ref",
    "twilio_or_sms_provider": "secret_ref",
    "generic_webhook_url": "secret_ref"
  }
}
```

- `rendered` must match the output shape from **message-template-renderer** (`subject`, `body`, `html_body`, `slack_payload`, `sms_body`, etc.).
- `escalation.recipients` and per-recipient `channels` come from **escalation-chain-resolver**.

## Delivery rules

1. **Outer loop**: each `recipient` in `escalation.recipients`.
2. **Inner loop**: each channel in the intersection of `recipient.channels` and `escalation.channels_active`.
3. **Idempotency**: derive a stable key `idempotency_key = hash(dispatch_id + contact_id + channel + finding_id_or_dispatch_id)`; providers that support idempotency headers must use it to prevent duplicate sends on retries.
4. **Partial success**: one failed channel must not block other channels or recipients; collect per-attempt results.
5. **Secrets**: read from environment / secret store only — never log token values (URLs may be logged redacted).
6. **PII**: log recipient identifiers as opaque `contact_id` where possible, not full email/phone in verbose logs.

## Channel behavior

| Channel | Source field | Notes |
|--------|----------------|-------|
| email | `rendered.subject`, `rendered.html_body` or `rendered.body` | Require subject; prefer HTML when present |
| slack | `rendered.slack_payload` | If JSON invalid, fall back to `{ "text": rendered.body }` |
| sms | `rendered.sms_body` | Hard cap 160 chars; strip formatting |
| webhook | `rendered.body` or full envelope | POST JSON; include `dispatch_id` and `tenant_id` in body for traceability |

Apply **rate-limiter-backoff** at the transport or workflow level when calling external APIs.

## Output (required for downstream steps)

Return a single structured result for the workflow:

```json
{
  "dispatch_id": "uuid-v4",
  "overall_status": "delivered | partial_failure | failed",
  "delivery_confirmations": [
    {
      "contact_id": "string | integer",
      "channel": "email | slack | sms | webhook",
      "status": "sent | failed | skipped",
      "provider_message_id": "string | null",
      "error": "string | null"
    }
  ],
  "completed_at": "ISO8601"
}
```

## After delivery

- **Finding alerts**: if `overall_status` is `delivered` or acceptable partial policy, invoke **Cooldown Record Writer** (`notification-cooldown` skill) so `last_alerted_at` updates.
- **Failures**: route terminal failures through **error-handler-dead-letter** with `source_skill: alert-dispatcher`.

## SecureWatch360 (this repo)

- Immediate notification transports may be stubs in some paths (for example digest jobs that record audit intent). When implementing real sends, tenant-scope all lookups, record **audit/evidence** as required by project patterns, and keep policy evaluation off the dispatcher (dispatcher is transport-only).

## Visual / third-party orchestrators (optional)

If you model delivery in a low-code tool, mirror the same contract: single **Alert Dispatcher** choke point, Split In Batches on `recipients`, then Switch on channel to SMTP / Slack / SMS / HTTP Request. Prefer implementing the dispatcher in **SecureWatch360** application code or Inngest steps so credentials and audit stay tenant-scoped.
