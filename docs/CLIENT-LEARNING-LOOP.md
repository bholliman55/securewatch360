# Client learning loop

SecureWatch360 records structured **client interaction learnings** so product and engineering can continuously improve: what we hear in QBRs, support, pilots, and in-app feedback becomes durable data, not lost chat history.

## Data model

Table: `public.client_interaction_learnings` (see migration `20260426120000_client_interaction_learnings.sql`).

Key fields:

| Field | Purpose |
|--------|---------|
| `source` | Where the signal came from (`in_app`, `support`, `qbr`, `onboarding`, `pilot`, `integration`, `api`, `other`). |
| `interaction_kind` | Type of signal (`feedback`, `friction`, `feature_request`, `blocker`, `workaround`, `confusion`, `praise`, `other`). |
| `title` / `body` | Human-readable summary and detail. |
| `structured_signals` | JSON for machine-friendly tags (e.g. workflow step, page, error code). |
| `impact` | `low` / `medium` / `high` for prioritization. |
| `product_area` | Optional bucket (e.g. `remediation`, `policy`, `incidents`). |
| `target_release` | Intended version (e.g. `v4.2`) for roadmap alignment. |
| `triage_status` | `new` → `reviewed` → `planned` → `in_progress` → `shipped` (or `wontfix`). |
| `shipped_in_version` / `release_notes_ref` | Close the loop when the work ships. |

## APIs

- `POST /api/client-learnings` — create (roles: owner, admin, analyst).
- `GET /api/client-learnings?tenantId=...` — list (includes viewer).
- `PATCH /api/client-learnings/{id}` — triage and release fields (owner, admin only).

All routes use the same tenant access guard as other v4 APIs.

## Internal use

- `recordClientLearning()` in `src/lib/clientLearning.ts` for workflows (integrations, future Inngest steps). Inserts are best-effort and logged on failure.

## Release ritual (suggested)

1. **During the sprint / program increment:** capture learnings as `new` with honest `impact` and `source`.
2. **Backlog / planning:** set `triage_status` to `reviewed` or `planned` and set `target_release` to the intended version.
3. **Build:** mark `in_progress` when work starts.
4. **Ship:** set `shipped` and `shipped_in_version` (and `release_notes_ref` if you publish public notes).

This gives a queryable history of *what customers taught us* and *which release addressed it*—the learning loop for the next version.
