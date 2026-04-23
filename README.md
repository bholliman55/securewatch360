# SecureWatch360 (MVP v1)

Free-stack MVP for a **multi-tenant security platform**: Next.js (App Router) for the web + API, **Supabase** for data, **Inngest** for durable workflows and orchestration (not n8n). This repo is structured for clarity so a new developer can find UI, APIs, jobs, database access, and scanner plug-ins quickly.

## What this project does (v1)

- Serves the marketing or app shell at `/` and JSON health at `/api/health`.
- Exposes **Inngest** at `/api/inngest` so the Inngest Dev Server or Inngest Cloud can register and run functions.
- Centralizes **Supabase** clients for the browser, for request-scoped server code, and optionally for trusted background work (service role).

## Quick start

1. Copy environment variables: copy `.env.local.example` to `.env.local` and fill in values from your Supabase project and Inngest dashboard.
2. Install: `npm install`
3. Dev: `npm run dev` — open [http://localhost:3000](http://localhost:3000).
4. Inngest local: run the [Inngest Dev Server](https://www.inngest.com/docs/dev-server) and point the app URL to your Next dev server so functions sync (e.g. `http://localhost:3000/api/inngest`).

## Suggested packages (already in `package.json`)

| Area        | Packages |
|------------|----------|
| Framework  | `next`, `react`, `react-dom`, `typescript` |
| Database   | `@supabase/supabase-js`, `@supabase/ssr` (cookie-aware server client) |
| Workflows  | `inngest` (functions + `inngest/next` serve handler) |

Optional next steps (not added by default): Zod for runtime validation, `@t3-oss/env-nextjs` for env parsing, testing with Vitest + MSW.

## Folder map (what lives where)

| Path | Purpose |
|------|--------|
| `src/app/` | App Router: pages, layouts, and `api/**/route.ts` Route Handlers. |
| `src/app/api/inngest/` | Inngest HTTP handler (`serve`) — **orchestration entry** for background work. |
| `src/lib/supabase/` | Supabase browser + server + service-role factories. |
| `src/inngest/` | Inngest **app id** and **function** modules; add new jobs as new files + list in `functions/index.ts`. |
| `src/scanner/adapters/` | Interfaces and per-vendor scanner implementations (called from Inngest `step.run`, not from n8n). |
| `src/types/` | Shared TypeScript types (e.g. event payload maps aligned with Inngest). |

## Exact file tree

```
securewatch360/
├── .env.local.example
├── .gitignore
├── CONTRIBUTING.md
├── AIRTABLE-SETUP.md
├── README.md
├── next-env.d.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── api/
    │       ├── health/
    │       │   └── route.ts
    │       └── inngest/
    │           └── route.ts
    ├── inngest/
    │   ├── client.ts
    │   └── functions/
    │       ├── index.ts
    │       └── scan-tenant.ts
    ├── lib/
    │   └── supabase/
    │       ├── client.ts
    │       └── server.ts
    ├── scanner/
    │   └── adapters/
    │       └── index.ts
    └── types/
        └── index.ts
```

## Remote repository

Create a repository under the **bholliman55** GitHub account and push this tree; use the branch strategy in `CONTRIBUTING.md` (`develop` for integration, `feature/*` for work).
