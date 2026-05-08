-- SecureWatch360: voice gateway persistence (ElevenLabs + future channels)
--
-- These tables back the `src/server/voice/` module:
--   - voice_sessions: long-lived conversation envelope (one per ElevenLabs call).
--   - voice_commands: each parsed/dispatched command in a session.
--   - voice_audit_events: durable audit trail mirroring the in-app audit_logs
--     pattern (received / executed / denied / etc.).
--   - voice_confirmation_requests: short-lived "say 'confirm'" challenges for
--     HIGH_RISK / DESTRUCTIVE actions.
--
-- Multi-tenancy convention: `client_id` aligns with `tenants.id` (matches the
-- v4 quantum tables and `tenant_users.tenant_id`). It is nullable here because
-- a voice session can begin before the agent has identified which tenant it
-- is acting on (e.g. the operator hasn't said "scan acme.com" yet); RLS still
-- prevents anonymous reads — only service-role writes can land NULL rows.

-- ---------------------------------------------------------------------------
-- voice_sessions
-- ---------------------------------------------------------------------------

create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid null references public.tenants (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  elevenlabs_conversation_id text null,
  channel text not null default 'elevenlabs',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint voice_sessions_status_check check (
    status in ('active', 'ended', 'failed', 'abandoned')
  ),
  constraint voice_sessions_channel_check check (
    channel in ('elevenlabs', 'browser', 'phone', 'test')
  )
);

comment on table public.voice_sessions is
  'One row per voice conversation; spans many voice_commands.';

comment on column public.voice_sessions.client_id is
  'Tenant scope (aligns with tenants.id). NULL until the conversation has identified its tenant.';

comment on column public.voice_sessions.elevenlabs_conversation_id is
  'Vendor-side conversation id used for cross-system correlation. Not unique because some vendors recycle.';

create index if not exists voice_sessions_client_id_idx
  on public.voice_sessions (client_id);

create index if not exists voice_sessions_user_id_idx
  on public.voice_sessions (user_id);

create index if not exists voice_sessions_elevenlabs_conv_idx
  on public.voice_sessions (elevenlabs_conversation_id);

create index if not exists voice_sessions_status_started_idx
  on public.voice_sessions (status, started_at desc);

-- ---------------------------------------------------------------------------
-- voice_commands
-- ---------------------------------------------------------------------------

create table if not exists public.voice_commands (
  id uuid primary key default gen_random_uuid(),
  voice_session_id uuid null references public.voice_sessions (id) on delete cascade,
  client_id uuid null references public.tenants (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  raw_transcript text not null,
  normalized_command text null,
  intent text not null,
  safety_level text not null,
  status text not null default 'received',
  requires_confirmation boolean not null default false,
  confirmed_at timestamptz null,
  executed_at timestamptz null,
  result_summary text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint voice_commands_safety_level_check check (
    safety_level in ('READ_ONLY', 'LOW_RISK_ACTION', 'HIGH_RISK_ACTION', 'DESTRUCTIVE_ACTION')
  ),
  constraint voice_commands_status_check check (
    status in ('received', 'awaiting_confirmation', 'denied', 'executed', 'failed', 'clarification_requested')
  )
);

comment on table public.voice_commands is
  'Each parsed voice command — classifier output + dispatch outcome.';

comment on column public.voice_commands.intent is
  'VoiceIntent enum value (RUN_EXTERNAL_SCAN, ISOLATE_ENDPOINT, UNKNOWN, …).';

comment on column public.voice_commands.safety_level is
  'CommandSafetyLevel: READ_ONLY | LOW_RISK_ACTION | HIGH_RISK_ACTION | DESTRUCTIVE_ACTION.';

create index if not exists voice_commands_session_idx
  on public.voice_commands (voice_session_id);

create index if not exists voice_commands_client_id_idx
  on public.voice_commands (client_id);

create index if not exists voice_commands_user_id_idx
  on public.voice_commands (user_id);

create index if not exists voice_commands_intent_idx
  on public.voice_commands (intent);

create index if not exists voice_commands_status_idx
  on public.voice_commands (status);

create index if not exists voice_commands_created_at_idx
  on public.voice_commands (created_at desc);

create index if not exists voice_commands_client_status_created_idx
  on public.voice_commands (client_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- voice_audit_events
-- ---------------------------------------------------------------------------

create table if not exists public.voice_audit_events (
  id uuid primary key default gen_random_uuid(),
  voice_session_id uuid null references public.voice_sessions (id) on delete cascade,
  voice_command_id uuid null references public.voice_commands (id) on delete cascade,
  client_id uuid null references public.tenants (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.voice_audit_events is
  'Durable audit trail for the voice gateway (mirrors audit_logs but voice-specific).';

comment on column public.voice_audit_events.event_type is
  'voice.command.received | voice.command.executed | voice.command.denied | voice.command.needs_confirmation | voice.command.error | voice.session.opened | voice.session.closed';

create index if not exists voice_audit_events_session_idx
  on public.voice_audit_events (voice_session_id);

create index if not exists voice_audit_events_command_idx
  on public.voice_audit_events (voice_command_id);

create index if not exists voice_audit_events_client_id_idx
  on public.voice_audit_events (client_id);

create index if not exists voice_audit_events_user_id_idx
  on public.voice_audit_events (user_id);

create index if not exists voice_audit_events_event_type_idx
  on public.voice_audit_events (event_type);

create index if not exists voice_audit_events_created_at_idx
  on public.voice_audit_events (created_at desc);

-- ---------------------------------------------------------------------------
-- voice_confirmation_requests
-- ---------------------------------------------------------------------------

create table if not exists public.voice_confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  voice_command_id uuid not null references public.voice_commands (id) on delete cascade,
  confirmation_phrase text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint voice_confirmation_requests_status_check check (
    status in ('pending', 'confirmed', 'rejected', 'expired')
  )
);

comment on table public.voice_confirmation_requests is
  'Short-lived "say confirm" challenges for HIGH_RISK / DESTRUCTIVE voice actions.';

create index if not exists voice_confirmation_requests_command_idx
  on public.voice_confirmation_requests (voice_command_id);

create index if not exists voice_confirmation_requests_status_idx
  on public.voice_confirmation_requests (status);

create index if not exists voice_confirmation_requests_expires_idx
  on public.voice_confirmation_requests (expires_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Convention: tenant_users membership gates SELECT for all tenant-scoped rows
-- (matches `20260505203000_quantum_tables_tenant_scoped_rls.sql`). Mutations
-- are restricted to operator-tier roles (owner/admin/analyst). Service-role
-- writes (the gateway running server-side) bypass RLS, which is how voice
-- sessions with NULL client_id get inserted before tenant resolution.

alter table public.voice_sessions enable row level security;
alter table public.voice_commands enable row level security;
alter table public.voice_audit_events enable row level security;
alter table public.voice_confirmation_requests enable row level security;

-- voice_sessions ------------------------------------------------------------

create policy "voice_sessions_select"
  on public.voice_sessions
  for select
  to authenticated
  using (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "voice_sessions_insert"
  on public.voice_sessions
  for insert
  to authenticated
  with check (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

create policy "voice_sessions_update"
  on public.voice_sessions
  for update
  to authenticated
  using (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  )
  with check (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

-- voice_commands ------------------------------------------------------------

create policy "voice_commands_select"
  on public.voice_commands
  for select
  to authenticated
  using (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "voice_commands_insert"
  on public.voice_commands
  for insert
  to authenticated
  with check (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

create policy "voice_commands_update"
  on public.voice_commands
  for update
  to authenticated
  using (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  )
  with check (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

-- voice_audit_events --------------------------------------------------------
-- Audit rows are append-only from the application's perspective. We allow
-- SELECT for tenant members but no UPDATE/DELETE policies — service role
-- inserts via getSupabaseAdminClient() (bypasses RLS).

create policy "voice_audit_events_select"
  on public.voice_audit_events
  for select
  to authenticated
  using (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
    )
  );

create policy "voice_audit_events_insert"
  on public.voice_audit_events
  for insert
  to authenticated
  with check (
    client_id is not null
    and client_id in (
      select tu.tenant_id
      from public.tenant_users tu
      where tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

-- voice_confirmation_requests ----------------------------------------------
-- Scoped via the parent voice_commands row (no direct client_id column).

create policy "voice_confirmation_requests_select"
  on public.voice_confirmation_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.voice_commands vc
      join public.tenant_users tu on tu.tenant_id = vc.client_id
      where vc.id = voice_confirmation_requests.voice_command_id
        and vc.client_id is not null
        and tu.user_id = (select auth.uid())
    )
  );

create policy "voice_confirmation_requests_insert"
  on public.voice_confirmation_requests
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.voice_commands vc
      join public.tenant_users tu on tu.tenant_id = vc.client_id
      where vc.id = voice_confirmation_requests.voice_command_id
        and vc.client_id is not null
        and tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );

create policy "voice_confirmation_requests_update"
  on public.voice_confirmation_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.voice_commands vc
      join public.tenant_users tu on tu.tenant_id = vc.client_id
      where vc.id = voice_confirmation_requests.voice_command_id
        and vc.client_id is not null
        and tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  )
  with check (
    exists (
      select 1
      from public.voice_commands vc
      join public.tenant_users tu on tu.tenant_id = vc.client_id
      where vc.id = voice_confirmation_requests.voice_command_id
        and vc.client_id is not null
        and tu.user_id = (select auth.uid())
        and tu.role in ('owner', 'admin', 'analyst')
    )
  );
