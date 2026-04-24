# SSO and SCIM (SecureWatch360)

This project uses **Supabase Auth** for identities. Tenant membership and `tenant_users.role` (`owner`, `admin`, `analyst`, `viewer`) are enforced in API route handlers (see `src/lib/tenant-guard.ts`).

## SSO (SAML or OIDC)

1. In the [Supabase Dashboard](https://supabase.com/dashboard) for your project, open **Authentication** → **Providers** and enable your IdP (Google, Azure AD / Entra, Okta OIDC, SAML, etc.) following Supabase’s provider docs.
2. Configure redirect URLs for your app origin (e.g. `https://yourapp.example.com/**` and `http://localhost:3000/**` for local dev).
3. Optional: store a human label in `tenants.sso_provider` and set `tenants.sso_enforced` after you add middleware that rejects non-SSO sessions (future work).

**Role model:** first user bootstrap per tenant must still insert into `public.tenant_users` (e.g. via `seed` script or admin SQL). The API does not auto-join SSO users to a tenant without a membership row.

## SCIM 2.0 (directory sync)

- Discovery: `GET /api/scim/v2/ServiceProviderConfig` returns SCIM 2.0 service provider metadata (skeleton; full user/group provisioning is a later milestone).
- Set `tenants.scim_enabled` when you are ready to pair a directory that issues a long-lived **SCIM bearer token** (to be stored as a Supabase secret or `vault` secret — not in app env for all tenants in one key).

**Today:** use `GET /api/tenant-users?tenantId=<uuid>` (admin or owner) to audit membership before enabling SCIM.

## Verification

1. Sign in via the IdP, confirm a session in **Account** (`/account`).
2. Call a tenant-scoped API (e.g. `GET /api/approval-requests?tenantId=...`) and confirm 200 for members, 403 without `tenant_users` row.

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — branching and PR process.
