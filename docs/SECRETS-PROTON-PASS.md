# Proton Pass Secret Workflow

This project supports using Proton Pass as the secret source of truth while keeping runtime injection ephemeral.

## Goals

- Keep secrets out of git and long-lived plaintext files.
- Store values once in Proton Pass.
- Inject at runtime for local dev and CI/CD.

## Prerequisites

1. Install Proton Pass CLI (`pass-cli`) on your machine.
2. Log in once:

```powershell
pass-cli login
```

1. Create a dedicated vault (recommended): `SecureWatch360`.
2. Create one item per environment:
   - `securewatch360-dev`
   - `securewatch360-staging`
   - `securewatch360-prod`

Use item fields for each env var key (for example `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_EVENT_KEY`, etc).

## Local Dev (Windows)

Use the helper script:

```powershell
cp .env.protonrefs.local.example .env.protonrefs.local
pwsh ./scripts/dev-with-proton-pass.ps1
```

What it does:

- Verifies `pass-cli` is available.
- Verifies you are logged in.
- Runs both `npm run dev` and `npm run inngest:dev` through `pass-cli run --env-file .env.protonrefs.local`.
- Secret references (`pass://...`) are resolved at process start and masked in output by default.

## CI/CD and Hosted Environments

Recommended pattern:

1. Keep Proton Pass as source-of-truth.
2. Mirror required secrets into GitHub Actions/Vercel environment variables.
3. Scope by environment (dev/staging/prod) and least privilege.
4. Rotate on schedule and after any exposure.

## Minimum Keys For Latest Features

- Core: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- AI: `ANTHROPIC_API_KEY`
- External intelligence: `BRIGHTDATA_API_KEY`, `BRIGHTDATA_WEB_UNLOCKER_ZONE`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_BROWSER_ZONE`

Connector keys are additionally required only if those integrations are used (ConnectWise, Jira, ServiceNow, Tenable, Semgrep).

## Security Notes

- Never commit `.env.local` or exported secret dumps.
- Avoid pasting secret values in terminal history where possible.
- If a secret appears in chat/screenshots/logs, rotate it.
