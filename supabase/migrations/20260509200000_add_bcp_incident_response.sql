-- Business Continuity Plan (BCP) contacts and incident response infrastructure.
-- BCP contacts define who gets notified (and how) when an incident reaches a
-- given severity threshold. Response plans attach procedures and escalation
-- chains to incident types.

-- BCP contacts: people who must be notified during a security incident.
create table if not exists public.bcp_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  title text,
  role text not null, -- e.g. ciso, ceo, legal, it_director, pr, external_counsel
  email text,
  phone text,
  slack_handle text,
  escalation_level integer not null default 1 check (escalation_level between 1 and 5),
  -- which severity levels trigger this contact
  notify_on_severity text[] not null default array['critical', 'high'],
  -- which incident categories trigger this contact
  notify_on_category text[] not null default array[]::text[],
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bcp_contacts is
  'Business Continuity Plan contacts for incident escalation and notification.';

comment on column public.bcp_contacts.escalation_level is
  '1 = first responder, 2 = team lead, 3 = management, 4 = executive, 5 = external/legal';

-- Incident response plans: playbooks attached to incident types/severities.
create table if not exists public.incident_response_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  description text,
  incident_category text, -- null = applies to all categories
  min_severity text not null default 'high'
    check (min_severity in ('info', 'low', 'medium', 'high', 'critical')),
  -- Ordered list of response steps (JSONB array of {step, owner, sla_hours, description})
  procedures jsonb not null default '[]'::jsonb,
  -- Whether to auto-notify BCP contacts when an incident matches this plan
  auto_notify boolean not null default true,
  -- Whether to auto-create remediation actions from the procedures
  auto_create_actions boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.incident_response_plans is
  'Incident response playbooks linked to incident categories and severities.';

-- Incident notifications log: track who was notified and when.
create table if not exists public.incident_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  bcp_contact_id uuid references public.bcp_contacts (id) on delete set null,
  channel text not null check (channel in ('email', 'phone', 'slack', 'sms', 'in_app')),
  recipient_name text,
  recipient_address text, -- email, phone, slack handle, etc.
  status text not null default 'sent'
    check (status in ('sent', 'delivered', 'failed', 'acknowledged')),
  sent_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  error_message text
);

comment on table public.incident_notifications is
  'Log of outbound notifications sent to BCP contacts during incidents.';

-- Indexes
create index if not exists bcp_contacts_tenant_idx on public.bcp_contacts (tenant_id);
create index if not exists bcp_contacts_escalation_idx on public.bcp_contacts (tenant_id, escalation_level);
create index if not exists incident_response_plans_tenant_idx on public.incident_response_plans (tenant_id);
create index if not exists incident_notifications_incident_idx on public.incident_notifications (incident_id);
create index if not exists incident_notifications_tenant_idx on public.incident_notifications (tenant_id);

-- RLS
alter table public.bcp_contacts enable row level security;
alter table public.incident_response_plans enable row level security;
alter table public.incident_notifications enable row level security;

create policy "tenant_isolation_bcp_contacts"
  on public.bcp_contacts
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
    )
  );

create policy "tenant_isolation_incident_response_plans"
  on public.incident_response_plans
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
    )
  );

create policy "tenant_isolation_incident_notifications"
  on public.incident_notifications
  for all
  using (
    tenant_id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
    )
  );

-- Allow service role full access (used by Inngest workflows and API routes)
create policy "service_role_bcp_contacts"
  on public.bcp_contacts
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_incident_response_plans"
  on public.incident_response_plans
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_incident_notifications"
  on public.incident_notifications
  for all
  to service_role
  using (true)
  with check (true);

-- Trigger to keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bcp_contacts_updated_at
  before update on public.bcp_contacts
  for each row execute function public.set_updated_at();

create trigger incident_response_plans_updated_at
  before update on public.incident_response_plans
  for each row execute function public.set_updated_at();
