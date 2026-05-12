-- Agent 6: Quantum Readiness Agent
-- Creates tables for cryptographic asset inventory, readiness assessments,
-- remediation task tracking, and policy evaluation results.

-- ── quantum_crypto_inventory ──────────────────────────────────────────────────
-- One row per discovered cryptographic asset per scan.

create table public.quantum_crypto_inventory (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null,
  asset_id                 uuid,
  scan_id                  uuid,
  asset_hostname           text,
  asset_ip                 text,
  asset_type               text,
  service_name             text,
  port                     integer,
  protocol                 text,
  crypto_usage             text not null,
  algorithm                text not null,
  key_length               integer,
  certificate_subject      text,
  certificate_issuer       text,
  certificate_expiration   timestamptz,
  tls_version              text,
  is_quantum_vulnerable    boolean not null default false,
  quantum_risk_level       text not null default 'unknown',
  discovery_source         text not null default 'agent6',
  evidence                 jsonb default '{}'::jsonb,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

comment on table public.quantum_crypto_inventory is
  'Discovered cryptographic assets per client/scan. Each row represents one '
  'crypto endpoint, certificate, key, or cipher suite surfaced by Agent 6.';

comment on column public.quantum_crypto_inventory.client_id is
  'MSP client tenant ID — top-level tenancy boundary.';
comment on column public.quantum_crypto_inventory.asset_id is
  'Optional reference to a scan_targets or findings row.';
comment on column public.quantum_crypto_inventory.crypto_usage is
  'Semantic usage context: tls, certificate, vpn, ssh, code_signing, '
  'email_encryption, database_encryption, api_authentication, unknown.';
comment on column public.quantum_crypto_inventory.quantum_risk_level is
  'Engine-assigned risk level: critical, high, medium, low, unknown.';
comment on column public.quantum_crypto_inventory.evidence is
  'Freeform JSON evidence bag including harvestNowDecryptLaterRisk flag, '
  'attack vectors, recommended replacements, and raw scanner metadata.';

create index quantum_crypto_inventory_client_id_idx
  on public.quantum_crypto_inventory (client_id);

create index quantum_crypto_inventory_scan_id_idx
  on public.quantum_crypto_inventory (scan_id)
  where scan_id is not null;

create index quantum_crypto_inventory_asset_id_idx
  on public.quantum_crypto_inventory (asset_id)
  where asset_id is not null;

create index quantum_crypto_inventory_algorithm_idx
  on public.quantum_crypto_inventory (algorithm);

create index quantum_crypto_inventory_risk_level_idx
  on public.quantum_crypto_inventory (quantum_risk_level);

create index quantum_crypto_inventory_created_at_idx
  on public.quantum_crypto_inventory (created_at desc);

create index quantum_crypto_inventory_vulnerable_idx
  on public.quantum_crypto_inventory (client_id, is_quantum_vulnerable)
  where is_quantum_vulnerable = true;

-- ── quantum_readiness_assessments ─────────────────────────────────────────────
-- Aggregate readiness score per client per scan run.

create table public.quantum_readiness_assessments (
  id                               uuid primary key default gen_random_uuid(),
  client_id                        uuid not null,
  scan_id                          uuid,
  readiness_score                  numeric not null,
  total_crypto_assets              integer not null default 0,
  vulnerable_crypto_assets         integer not null default 0,
  high_risk_assets                 integer not null default 0,
  medium_risk_assets               integer not null default 0,
  low_risk_assets                  integer not null default 0,
  harvest_now_decrypt_later_exposure boolean not null default false,
  recommended_priority             text not null default 'medium',
  summary                          text,
  created_at                       timestamptz default now()
);

comment on table public.quantum_readiness_assessments is
  'Aggregate Quantum Readiness Score per client/scan. Score ranges 0–100; '
  '100 = fully quantum-ready. One row per assessment run.';

comment on column public.quantum_readiness_assessments.readiness_score is
  'Quantum readiness score 0–100. Calculated by subtracting penalties for '
  'critical (-20), high (-12), medium (-6), unknown (-3) findings, plus a '
  'one-time -15 penalty for harvest-now-decrypt-later exposure.';
comment on column public.quantum_readiness_assessments.recommended_priority is
  'Derived from score: 0-39=critical, 40-69=high, 70-84=medium, 85-100=low.';
comment on column public.quantum_readiness_assessments.harvest_now_decrypt_later_exposure is
  'True when any asset is exposed to adversarial ciphertext harvesting for '
  'future quantum decryption.';

create index quantum_readiness_assessments_client_id_idx
  on public.quantum_readiness_assessments (client_id);

create index quantum_readiness_assessments_scan_id_idx
  on public.quantum_readiness_assessments (scan_id)
  where scan_id is not null;

create index quantum_readiness_assessments_created_at_idx
  on public.quantum_readiness_assessments (created_at desc);

create index quantum_readiness_assessments_score_idx
  on public.quantum_readiness_assessments (client_id, readiness_score);

-- ── quantum_remediation_tasks ─────────────────────────────────────────────────
-- Actionable remediation tasks generated per inventory item.

create table public.quantum_remediation_tasks (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null,
  assessment_id        uuid references public.quantum_readiness_assessments (id) on delete set null,
  inventory_id         uuid references public.quantum_crypto_inventory (id) on delete set null,
  title                text not null,
  description          text not null,
  priority             text not null,
  recommended_action   text not null,
  target_standard      text,
  estimated_effort     text,
  status               text not null default 'open',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

comment on table public.quantum_remediation_tasks is
  'Actionable remediation tasks generated by Agent 6 for quantum-vulnerable '
  'cryptographic assets. Linked to the originating inventory item and assessment.';

comment on column public.quantum_remediation_tasks.priority is
  'Task priority: critical, high, medium, low.';
comment on column public.quantum_remediation_tasks.status is
  'Task lifecycle: open, in_progress, resolved, accepted_risk, wont_fix.';
comment on column public.quantum_remediation_tasks.target_standard is
  'Recommended replacement algorithm or standard, e.g. ML-KEM-768 (FIPS 203).';
comment on column public.quantum_remediation_tasks.estimated_effort is
  'Human-readable effort estimate, e.g. "1-2 weeks", "3-7 days".';

create index quantum_remediation_tasks_client_id_idx
  on public.quantum_remediation_tasks (client_id);

create index quantum_remediation_tasks_assessment_id_idx
  on public.quantum_remediation_tasks (assessment_id)
  where assessment_id is not null;

create index quantum_remediation_tasks_inventory_id_idx
  on public.quantum_remediation_tasks (inventory_id)
  where inventory_id is not null;

create index quantum_remediation_tasks_priority_idx
  on public.quantum_remediation_tasks (client_id, priority);

create index quantum_remediation_tasks_status_idx
  on public.quantum_remediation_tasks (client_id, status);

create index quantum_remediation_tasks_created_at_idx
  on public.quantum_remediation_tasks (created_at desc);

-- ── quantum_policy_results ────────────────────────────────────────────────────
-- Per-asset policy evaluation results from Rego/OPA policy runs.

create table public.quantum_policy_results (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null,
  inventory_id   uuid references public.quantum_crypto_inventory (id) on delete cascade,
  policy_id      text not null,
  policy_name    text not null,
  passed         boolean not null,
  severity       text not null,
  message        text not null,
  evidence       jsonb default '{}'::jsonb,
  created_at     timestamptz default now()
);

comment on table public.quantum_policy_results is
  'Policy-as-code evaluation results per cryptographic asset. Each row records '
  'whether a specific Rego policy passed or failed for a given inventory item.';

comment on column public.quantum_policy_results.policy_id is
  'Stable policy rule identifier, e.g. QCP-001, QTLS-003, QVND-002.';
comment on column public.quantum_policy_results.severity is
  'Policy severity if failed: critical, high, medium, low.';
comment on column public.quantum_policy_results.evidence is
  'Contextual evidence bag: algorithm, tlsVersion, assetType, keyLength, etc.';

create index quantum_policy_results_client_id_idx
  on public.quantum_policy_results (client_id);

create index quantum_policy_results_inventory_id_idx
  on public.quantum_policy_results (inventory_id)
  where inventory_id is not null;

create index quantum_policy_results_policy_id_idx
  on public.quantum_policy_results (policy_id);

create index quantum_policy_results_passed_idx
  on public.quantum_policy_results (client_id, passed);

create index quantum_policy_results_created_at_idx
  on public.quantum_policy_results (created_at desc);

-- ── updated_at triggers ───────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger quantum_crypto_inventory_updated_at
  before update on public.quantum_crypto_inventory
  for each row execute function public.set_updated_at();

create trigger quantum_remediation_tasks_updated_at
  before update on public.quantum_remediation_tasks
  for each row execute function public.set_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- RLS is enabled on all tables. Access is gated on client_id matching the
-- authenticated user's organization membership.
--
-- TODO: Replace the placeholder subquery below with the actual org-membership
-- table once tenant_users / organization_members is confirmed. Example:
--   (select client_id from public.org_members where user_id = auth.uid())
-- For now, policies use a no-op true condition so the schema deploys cleanly.

alter table public.quantum_crypto_inventory enable row level security;
alter table public.quantum_readiness_assessments enable row level security;
alter table public.quantum_remediation_tasks enable row level security;
alter table public.quantum_policy_results enable row level security;

-- quantum_crypto_inventory policies

create policy "quantum_crypto_inventory_select"
  on public.quantum_crypto_inventory
  for select
  to authenticated
  using (
    -- TODO: replace with org membership lookup, e.g.:
    -- client_id in (select client_id from public.tenant_users where user_id = auth.uid())
    client_id in (
      select id from public.tenants
      where id = client_id
    )
  );

create policy "quantum_crypto_inventory_insert"
  on public.quantum_crypto_inventory
  for insert
  to authenticated
  with check (
    -- TODO: restrict to service-role or agent context in production
    true
  );

create policy "quantum_crypto_inventory_update"
  on public.quantum_crypto_inventory
  for update
  to authenticated
  using (true)
  with check (true);

-- quantum_readiness_assessments policies

create policy "quantum_readiness_assessments_select"
  on public.quantum_readiness_assessments
  for select
  to authenticated
  using (
    -- TODO: org membership lookup
    true
  );

create policy "quantum_readiness_assessments_insert"
  on public.quantum_readiness_assessments
  for insert
  to authenticated
  with check (true);

-- quantum_remediation_tasks policies

create policy "quantum_remediation_tasks_select"
  on public.quantum_remediation_tasks
  for select
  to authenticated
  using (
    -- TODO: org membership lookup
    true
  );

create policy "quantum_remediation_tasks_insert"
  on public.quantum_remediation_tasks
  for insert
  to authenticated
  with check (true);

create policy "quantum_remediation_tasks_update"
  on public.quantum_remediation_tasks
  for update
  to authenticated
  using (true)
  with check (true);

-- quantum_policy_results policies

create policy "quantum_policy_results_select"
  on public.quantum_policy_results
  for select
  to authenticated
  using (
    -- TODO: org membership lookup
    true
  );

create policy "quantum_policy_results_insert"
  on public.quantum_policy_results
  for insert
  to authenticated
  with check (true);
