# SecureWatch360 Token Optimization Layer

## Purpose

The token optimization layer reduces LLM cost and latency while keeping security and policy control in deterministic SecureWatch360 services.

It standardizes how Scanner, Vulnerability, Compliance, Remediation, and Monitoring agents prepare and send LLM requests.

## Core Rule

No agent should call provider SDKs directly.  
All LLM interactions must flow through `optimizedLlmGateway`.

## Architecture

Main modules under `src/lib/token-optimization/`:

- `optimizedLlmGateway.ts`
  - Main orchestration entrypoint
  - Sanitization, budget checks, hashing, cache, provider call, logging
- `contextSanitizer.ts`
  - Redacts sensitive fields and removes noisy payloads
- `contextCompressor.ts`
  - Deterministic compression strategies (rules-based, no LLM)
- `promptBudgetManager.ts`
  - Per-tenant/per-agent budget loading and fallback enforcement
- `llmCacheService.ts`
  - Tenant/global response cache with `prompt_hash` + `input_fingerprint`
- `llmPromptLogService.ts`
  - Prompt lifecycle logging (`start` / `success` / `failure`)
- `contextSummaryService.ts`
  - Reusable summary storage keyed by `source_hash`
- `providerAdapter.ts`, `mockLlmProviderAdapter.ts`
  - Provider abstraction and deterministic local mock adapter
- `context-builders/*`
  - Agent-specific context shaping/loaders

## Where It Sits in Agent Workflow

High-level sequence:

1. Agent performs deterministic policy/rule decisioning.
2. Agent loads compact context via agent-specific builder.
3. Agent calls `optimizedLlmGateway`.
4. Gateway:
   - sanitizes context
   - enforces token budget
   - checks cache
   - calls provider adapter on miss
   - writes cache/logs
5. Agent uses LLM output for assistive wording only (not policy/execution).
6. Agent continues deterministic execution path.

## Database Tables

Used tables (Supabase/Postgres):

- `llm_prompt_logs`
  - Request/usage/error telemetry per LLM interaction
- `llm_response_cache`
  - Reusable cached responses (JSONB payloads)
- `context_summaries`
  - Reusable summaries with source freshness tracking
- `token_budgets`
  - Active token/cost budget rules and fallback strategy

## Cache Strategy

- Keying uses `prompt_hash` and `input_fingerprint`
- Supports tenant-specific cache and global reusable cache fallback
- Honors `expires_at`
- Cache usage controlled by `shouldUseCache(taskType, agentName)`
- Skips writes when:
  - caching disabled
  - task is non-cacheable
  - request appears to contain secrets

Recommended cache behavior:

- remediation recommendation: yes
- compliance control explanation: yes
- raw incident investigation: maybe
- active exploit response: usually no

## Prompt Budget Strategy

- Load active DB budgets from `token_budgets`
- If missing, use agent defaults (scanner/vulnerability/compliance/remediation/monitoring)
- Enforce using `enforcePromptBudget(...)`
- Fallback strategies:
  - `compress`
  - `summary_only`
  - `high_severity_only`
  - `reject_with_error`

## Context Compression Strategy

Deterministic (rules-based) strategies in `contextCompressor.ts`:

- `keep_high_severity_first`
- `summarize_repeated_findings`
- `drop_low_signal_fields`
- `evidence_summary_only`
- `control_mapping_only`

No LLM calls inside compressor v1.

## Sensitive Data Handling

Before prompt construction:

- redact/remove API keys, tokens, passwords, cookies, auth headers, private webhook URLs, secrets/private keys
- remove noisy fields like raw scanner logs and stack traces (unless explicitly allowed)
- truncate oversized payload fields

Default behavior avoids storing full prompt text in logs.

## Provider Adapter Model

Provider interface is in `providerAdapter.ts`:

- `LlmProviderAdapter.complete(request)`
- returns normalized response:
  - `content`
  - optional token usage
  - optional parsed JSON/raw payload

Current implementation:

- `MockLlmProviderAdapter` only (deterministic, test-safe)
- No paid provider dependencies in v1

Future adapters can target OpenAI, Anthropic, Ollama, or others without changing gateway contracts.

## QA / Verification

Run these commands:

- `npm run qa:token-optimization`
- `npm run qa:token-estimator`
- `npm run qa:prompt-hash`
- `npm run qa:context-sanitizer`
- `npm run qa:context-compressor`

Token optimization QA script validates hashing, redaction, compression, budget fallback, cache hit/miss, prompt logging, and usage summary.

## What Not to Send to LLMs

Never send:

- raw credentials, API keys, tokens, passwords
- session cookies or auth headers
- private webhook URLs
- private key material
- full raw scanner logs by default
- policy decision authority or execution authority

LLMs in SecureWatch360 are assistive only (summary/explanation/recommendation wording).

## Future Improvements

- Add provider-specific adapters with unified retry/timeouts
- Add per-model cost tables (instead of fixed estimate)
- Add richer summary lifecycle management and invalidation policies
- Add background cache cleanup jobs for expired rows
- Add route-level and tenant-level rate limiting for LLM usage APIs
- Add dashboard drill-down pages for workflow-level token traces
