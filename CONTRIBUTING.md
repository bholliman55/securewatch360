# Contributing to SecureWatch360

## Git and branches

This project follows a simplified Git Flow (see your team’s branching doc for full detail):

1. **Default integration branch:** `develop` (create it on the remote if this is a new repo).
2. **Feature work:** `git checkout develop && git pull && git checkout -b feature/<short-description>`.
3. **Commit messages:** use clear prefixes, e.g. `feat:`, `fix:`, `chore:`.
4. **Merge:** open a PR into `develop` (or `main` for release/hotfix per policy); use squash merge for feature PRs unless your team requires otherwise.

## Checks before you open a PR

- `npm run typecheck` (or `npx tsc --noEmit`) passes.
- `npm run build` passes.
- New Inngest functions are exported from `src/inngest/functions/index.ts` and listed in the Inngest dashboard / Dev Server after deploy.

## Where to add code

- **UI / routes:** `src/app/`
- **REST or JSON APIs:** `src/app/api/.../route.ts`
- **Background jobs:** `src/inngest/functions/` (orchestration stays in Inngest, not n8n)
- **Supabase access:** `src/lib/supabase/` (never expose the service role key to the client)

## Verifying the agent or another contributor

- Confirm the diff only touches the agreed scope.
- Confirm secrets are not committed (only `.env.local.example` placeholders).
- Confirm `/api/inngest` is still the single serve endpoint for Inngest.
