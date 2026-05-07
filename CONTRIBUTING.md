# Contributing to SecureWatch360

## Git and branches

This repository uses **feature branches and pull requests** targeted at **`main`**.

1. **Feature work:** `git checkout main && git pull origin main && git checkout -b feature/<short-description>`.
2. **Commit messages:** use clear prefixes, e.g. `feat:`, `fix:`, `chore:`.
3. **Ship:** open a PR into **`main`**, get review / CI green, then merge (squash merge is typical for features unless policy says otherwise).
4. **Hotfixes:** branch from **`main`**, fix, PR back to **`main`**.

Optional **`develop`** or other long-lived branches may exist for team experiments, but the default integration target for changes is **`main`**.

## Checks before you open a PR

- `npm run typecheck` (or `npx tsc --noEmit`) passes.
- `npm run build` passes.
- If you change `20260425150000_policy_pack_full_catalog.sql` or `scripts/generate-policy-pack-full-sql.mjs` inputs, run **`npm run generate:policy-pack-iac`** and commit the regenerated `iac/securewatch360-policy-pack/` outputs.
- Security checks pass for your scope:
  - `npm audit --audit-level=high` (or `snyk test` when configured)
  - `npx semgrep --config p/owasp-top-ten --error`
  - `trivy fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL .`
- New Inngest functions are exported from `src/inngest/functions/index.ts` and listed in the Inngest dashboard / Dev Server after deploy.

## Where to add code

- **UI / routes:** `src/app/`
- **REST or JSON APIs:** `src/app/api/.../route.ts`
- **Background jobs:** `src/inngest/functions/` (orchestration stays in Inngest)
- **Supabase access:** `src/lib/supabase.ts` (never expose the service role key to the client)

## Verifying the agent or another contributor

- Confirm the diff only touches the agreed scope.
- Confirm secrets are not committed (only `.env.local.example` placeholders).
- Confirm `/api/inngest` is still the single serve endpoint for Inngest.
