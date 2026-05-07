# Contributing to SecureWatch360

## Git and branches

Promotion order for this repo (do not skip steps for normal work):

1. **`develop`** — default integration branch. All feature PRs merge here first (`feature/*` → `develop`).
2. **`staging`** — pre-production validation. Promote with a PR or merge **`develop` → `staging`** after CI and manual smoke tests.
3. **`main`** — production. Promote with a PR or merge **`staging` → `main`** after staging sign-off.

Feature workflow:

1. `git fetch origin && git checkout develop && git pull origin develop`
2. `git checkout -b feature/<short-description>`
3. Commit with clear prefixes (`feat:`, `fix:`, `chore:`).
4. Open a PR **into `develop`** (squash merge for features unless policy says otherwise).
5. After merge to `develop`, open **`develop` → `staging`**, then **`staging` → `main`** when ready to release.

**Remote setup:** ensure `origin` fetches all heads (`git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"`) so local `origin/develop` and `origin/staging` stay current.

Hotfixes: branch from `main`, fix, PR to `main`, then back-merge into `staging` and `develop` so no branch drifts.

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
