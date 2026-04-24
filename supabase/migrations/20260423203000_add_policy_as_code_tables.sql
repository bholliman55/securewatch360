-- SecureWatch360 v4: policy-as-code storage foundation
-- Purpose:
-- 1) store policy definitions (rego and metadata)
-- 2) bind policies to runtime targets
-- 3) capture policy evaluation decisions for audit/explainability

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  name text not null,
  policy_type text not null,
  framework text,
  description text,
  rego_code text not null,
  is_active boolean not null default true,
  version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.policies is
  'Policy definitions (often Rego) used to evaluate findings/remediation behavior. tenant_id null means globally reusable policy.';

comment on column public.policies.policy_type is
  'Policy category such as gating, remediation, compliance, escalation.';

comment on column public.policies.framework is
  'Optional framework scope for policy intent, e.g. soc2, cmmc, nist, hipaa.';

comment on column public.policies.rego_code is
  'Raw Rego policy source code.';

create table if not exists public.policy_bindings (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  binding_type text not null,
  binding_target text not null,
  created_at timestamptz not null default now()
);

comment on table public.policy_bindings is
  'Where a policy applies, e.g. tenant, target_type, scanner, control, or workflow stage.';

comment on column public.policy_bindings.binding_type is
  'Binding classifier, e.g. tenant, target_type, scanner, control_id.';

comment on column public.policy_bindings.binding_target is
  'Concrete value for the binding_type, e.g. tenant UUID or target_type value.';

create table if not exists public.policy_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finding_id uuid references public.findings (id) on delete set null,
  remediation_action_id uuid references public.remediation_actions (id) on delete set null,
  policy_id uuid references public.policies (id) on delete set null,
  decision_type text not null,
  decision_result text not null,
  reason text,
  input_payload jsonb not null default '{}',
  output_payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.policy_decisions is
  'Immutable decision log from policy evaluations, including inputs/outputs and rationale.';

comment on column public.policy_decisions.decision_type is
  'Decision domain, e.g. finding_triage, remediation_approval, evidence_gating.';

comment on column public.policy_decisions.decision_result is
  'Evaluation result, e.g. allow, deny, require_approval, defer.';

-- Useful query indexes (lean v4 starter)
create index if not exists policies_tenant_id_idx
  on public.policies (tenant_id);

create index if not exists policies_type_active_idx
  on public.policies (policy_type, is_active);

create index if not exists policies_framework_idx
  on public.policies (framework);

create unique index if not exists policies_tenant_name_version_uniq
  on public.policies (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    name,
    version
  );

create index if not exists policy_bindings_policy_id_idx
  on public.policy_bindings (policy_id);

create index if not exists policy_bindings_type_target_idx
  on public.policy_bindings (binding_type, binding_target);

create index if not exists policy_decisions_tenant_created_at_idx
  on public.policy_decisions (tenant_id, created_at desc);

create index if not exists policy_decisions_finding_id_idx
  on public.policy_decisions (finding_id);

create index if not exists policy_decisions_remediation_action_id_idx
  on public.policy_decisions (remediation_action_id);

create index if not exists policy_decisions_policy_id_idx
  on public.policy_decisions (policy_id);

create index if not exists policy_decisions_type_result_idx
  on public.policy_decisions (decision_type, decision_result);
