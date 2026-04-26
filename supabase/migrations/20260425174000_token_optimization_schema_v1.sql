create table if not exists public.llm_prompt_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete set null,
  workflow_run_id uuid null,
  agent_name text not null,
  task_type text not null,
  model_provider text not null,
  model_name text not null,
  prompt_hash text not null,
  cache_hit boolean not null default false,
  input_tokens integer null,
  output_tokens integer null,
  estimated_cost numeric(12, 6) null,
  status text not null default 'success',
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_llm_prompt_logs_tenant_created_at
  on public.llm_prompt_logs (tenant_id, created_at desc);
create index if not exists idx_llm_prompt_logs_workflow_run_id
  on public.llm_prompt_logs (workflow_run_id);
create index if not exists idx_llm_prompt_logs_agent_task_created_at
  on public.llm_prompt_logs (agent_name, task_type, created_at desc);
create index if not exists idx_llm_prompt_logs_prompt_hash
  on public.llm_prompt_logs (prompt_hash);
create index if not exists idx_llm_prompt_logs_status
  on public.llm_prompt_logs (status);

create table if not exists public.llm_response_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete set null,
  agent_name text not null,
  task_type text not null,
  prompt_hash text not null,
  input_fingerprint text not null,
  response_payload jsonb not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_name, task_type, prompt_hash)
);

create index if not exists idx_llm_response_cache_tenant_agent_task
  on public.llm_response_cache (tenant_id, agent_name, task_type);
create index if not exists idx_llm_response_cache_expires_at
  on public.llm_response_cache (expires_at);
create index if not exists idx_llm_response_cache_input_fingerprint
  on public.llm_response_cache (input_fingerprint);
create index if not exists idx_llm_response_cache_payload_gin
  on public.llm_response_cache using gin (response_payload);

create table if not exists public.context_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  summary_type text not null,
  summary_text text not null,
  source_hash text not null,
  token_estimate integer null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id, summary_type, source_hash)
);

create index if not exists idx_context_summaries_tenant_entity
  on public.context_summaries (tenant_id, entity_type, entity_id);
create index if not exists idx_context_summaries_summary_type
  on public.context_summaries (summary_type);
create index if not exists idx_context_summaries_expires_at
  on public.context_summaries (expires_at);

create table if not exists public.token_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants(id) on delete set null,
  agent_name text not null,
  task_type text not null,
  max_input_tokens integer not null default 2500,
  max_output_tokens integer not null default 400,
  max_estimated_cost numeric(12, 6) null,
  fallback_strategy text not null default 'trim_context',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_name, task_type)
);

create index if not exists idx_token_budgets_tenant_agent_task
  on public.token_budgets (tenant_id, agent_name, task_type);
create index if not exists idx_token_budgets_is_active
  on public.token_budgets (is_active);
