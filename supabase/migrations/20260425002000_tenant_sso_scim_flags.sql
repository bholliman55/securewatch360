-- Enterprise auth hints (configuration lives in IdP + Supabase Auth; these are app-level labels)

alter table public.tenants
  add column if not exists sso_provider text,
  add column if not exists sso_enforced boolean not null default false,
  add column if not exists scim_enabled boolean not null default false;

comment on column public.tenants.sso_provider is
  'Label for the primary IdP (e.g. okta, azure_ad, google); not a security boundary by itself.';

comment on column public.tenants.sso_enforced is
  'When true, the product may reject password-only sign-in for this tenant in future middleware.';

comment on column public.tenants.scim_enabled is
  'When true, a SCIM bearer-provisioned user sync can be allowed for the tenant.';
