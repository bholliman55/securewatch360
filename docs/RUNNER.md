# Optional SecureWatch360 runner (on‑prem telemetry)

Lightweight process that registers presence by posting to `POST /api/runner/heartbeat`.

## Server configuration

| Variable | Required | Description |
|---------|----------|-------------|
| `SW360_RUNNER_TOKEN` | Yes | Shared secret (≥16 chars). Runners send `Authorization: Bearer …`. |

Apply migration `20260502140000_runner_heartbeats.sql` (`supabase db push`).

## Runner process

| Variable | Required | Description |
|---------|----------|-------------|
| `SW360_RUNNER_TOKEN` | Yes | Same value as on the server |
| `SW360_RUNNER_TENANT_ID` | Yes | Tenant UUID |
| `SW360_API_BASE` | No | Default `http://localhost:3000` |
| `SW360_RUNNER_ID` | No | Stable id (defaults to hostname) |
| `SW360_RUNNER_INTERVAL_S` | No | Heartbeat interval (default 120, minimum 30) |
| `SW360_RUNNER_VERSION` | No | Version string for observability |

```bash
set SW360_RUNNER_TOKEN=...
set SW360_RUNNER_TENANT_ID=...
npm run runner:dev
```

Use a secrets manager or systemd environment file in production; rotate `SW360_RUNNER_TOKEN` with runner redeploys.
