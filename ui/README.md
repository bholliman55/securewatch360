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

## Related

- Root project: `../README.md`
- Supabase Edge Functions: `../supabase/functions/` and `../ui/supabase/functions/` (see root `README.md` for deploy order)
