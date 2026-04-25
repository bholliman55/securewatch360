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

## Related

- Root project: `../README.md`
- Supabase Edge Functions: `../supabase/functions/` and `../ui/supabase/functions/` (see root `README.md` for deploy order)
