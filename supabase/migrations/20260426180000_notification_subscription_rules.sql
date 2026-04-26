-- SecureWatch360: per-tenant and per-user notification subscription rules (MVP hub)

create table if not exists public.notification_subscription_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  label text not null default '',
  min_severity text not null,
  channel text not null,
  digest_interval text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_subscription_rules_min_severity_check
    check (min_severity in ('info', 'low', 'medium', 'high', 'critical')),
  constraint notification_subscription_rules_channel_check
    check (channel in ('email', 'slack', 'in_app')),
  constraint notification_subscription_rules_digest_interval_check
    check (digest_interval in ('off', 'hourly', 'daily', 'weekly'))
);

comment on table public.notification_subscription_rules is
  'Tenant-wide (user_id null) or per-user notification routing and digest preferences.';

comment on column public.notification_subscription_rules.user_id is
  'When null, rule applies to the tenant; when set, only that user.';

create unique index if not exists notification_subscription_rules_scope_dedup_idx
  on public.notification_subscription_rules
  (tenant_id, channel, label, (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)));

create index if not exists notification_subscription_rules_tenant_id_idx
  on public.notification_subscription_rules (tenant_id);

create index if not exists notification_subscription_rules_tenant_user_idx
  on public.notification_subscription_rules (tenant_id, user_id)
  where user_id is not null;

create index if not exists notification_subscription_rules_digest_idx
  on public.notification_subscription_rules (tenant_id, digest_interval, enabled)
  where enabled = true and digest_interval <> 'off';

alter table public.notification_subscription_rules enable row level security;

-- Authenticated: read rules for own tenant; tenant defaults visible to all members; user rows to self or owners/admins.
create policy "notification_rules_select"
  on public.notification_subscription_rules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = notification_subscription_rules.tenant_id
        and tu.user_id = (select auth.uid())
    )
    and (
      notification_subscription_rules.user_id is null
      or notification_subscription_rules.user_id = (select auth.uid())
      or exists (
        select 1
        from public.tenant_users tu2
        where tu2.tenant_id = notification_subscription_rules.tenant_id
          and tu2.user_id = (select auth.uid())
          and tu2.role in ('owner', 'admin')
      )
    )
  );

-- Insert: must be a member; tenant-scoped only owner|admin; user-scoped self or owner|admin.
create policy "notification_rules_insert"
  on public.notification_subscription_rules
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = notification_subscription_rules.tenant_id
        and tu.user_id = (select auth.uid())
    )
    and (
      (
        notification_subscription_rules.user_id is null
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
      or (
        notification_subscription_rules.user_id is not null
        and notification_subscription_rules.user_id = (select auth.uid())
      )
      or (
        notification_subscription_rules.user_id is not null
        and notification_subscription_rules.user_id <> (select auth.uid())
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
    )
  );

-- Update: same visibility as select; only owner|admin can change tenant-scoped; user or admin can change user-scoped.
create policy "notification_rules_update"
  on public.notification_subscription_rules
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = notification_subscription_rules.tenant_id
        and tu.user_id = (select auth.uid())
    )
    and (
      (
        notification_subscription_rules.user_id is null
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
      or (
        notification_subscription_rules.user_id is not null
        and notification_subscription_rules.user_id = (select auth.uid())
      )
      or (
        notification_subscription_rules.user_id is not null
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
    )
  )
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = notification_subscription_rules.tenant_id
        and tu.user_id = (select auth.uid())
    )
    and (
      (
        notification_subscription_rules.user_id is null
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
      or (
        notification_subscription_rules.user_id is not null
        and (
          notification_subscription_rules.user_id = (select auth.uid())
          or exists (
            select 1
            from public.tenant_users tu2
            where tu2.tenant_id = notification_subscription_rules.tenant_id
              and tu2.user_id = (select auth.uid())
              and tu2.role in ('owner', 'admin')
          )
        )
      )
    )
  );

-- Delete: same as update
create policy "notification_rules_delete"
  on public.notification_subscription_rules
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = notification_subscription_rules.tenant_id
        and tu.user_id = (select auth.uid())
    )
    and (
      (
        notification_subscription_rules.user_id is null
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
      or (
        notification_subscription_rules.user_id is not null
        and notification_subscription_rules.user_id = (select auth.uid())
      )
      or (
        notification_subscription_rules.user_id is not null
        and exists (
          select 1
          from public.tenant_users tu2
          where tu2.tenant_id = notification_subscription_rules.tenant_id
            and tu2.user_id = (select auth.uid())
            and tu2.role in ('owner', 'admin')
        )
      )
    )
  );
