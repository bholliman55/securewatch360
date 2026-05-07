# SecureWatch360 UI

Vite + React + TypeScript dashboard for **SecureWatch360** (security operations views: dashboard, scanner, monitoring, compliance, training, incidents, analytics, settings).

## Prerequisites

- Node.js 18+ recommended
- Environment variables as documented in the repo root `README.md` and `docs/api-credentials.env` (Supabase and related keys for the UI and edge functions)

## Commands

From this directory (`ui/`):

```bash
npm install
npm run dev          # local dev server (Vite)
npm run build        # production build → dist/
npm run preview      # serve dist/ for smoke tests
npm run lint
npm run typecheck
```

## Ticketing (ConnectWise)

The UI calls the Next.js BFF at `/api/integrations/connectwise/tickets` (see root `src/app/api/integrations/connectwise/tickets/route.ts`). **Vite** proxies `/api` to the Next app (`VITE_NEXT_DEV_URL` or `http://127.0.0.1:3000`), so for local use run the root app (`npm run dev` in the repo root) on port 3000, or set `VITE_NEXT_DEV_URL` to your deployed API.

ConnectWise must be configured on the server (env/credentials in `connectwise` lib) or list/create will return 503.

## Troubleshooting console + API (local)

- **Vite proxies `/api` to** `VITE_NEXT_DEV_URL` if set, otherwise **`http://127.0.0.1:3000`**. If `next dev` prints *“Port 3000 is in use … using … 3001”*, the UI will still call **3000** unless you point it at the real server, e.g. create `ui/.env.local` with `VITE_NEXT_DEV_URL=http://127.0.0.1:3001` (or stop the extra process and run a single Next server on 3000).

- **HTTP 500 / “Internal Server Error”** while the Network tab shows `/api/...` failing: you may be hitting a **stale or broken** Next process on 3000 (e.g. Next error: missing `.next/server/app/api/.../route.js`). Stop all `node`/`next` dev servers for this repo, delete the root `.next` folder if needed, run **`npm run dev` once** so it binds to 3000 (or set `VITE_NEXT_DEV_URL` to the port that actually works), then restart **`npm run ui:dev`**.

## Related

- Root project: `../README.md`
- Supabase Edge Functions: `../supabase/functions/` and `../ui/supabase/functions/` (see root `README.md` for deploy order)

## Legacy `server.js`

`ui/server.js` is a static host + optional API helpers. **`POST /api/run-scan` returns HTTP 410 Gone** — scans are not initiated through external workflow tooling; use the **SecureWatch360 Next.js** app and **Inngest** (`scan-tenant`, `POST /api/scans/request`, etc.). **`POST /api/scan-webhook-response`** remains for generic JSON callbacks that update `scan_results` (if you still wire a custom orchestrator).

The **execute-scan** Edge Function under `ui/supabase/functions/execute-scan/` runs built-in scan plugins only (no outbound workflow webhooks).
