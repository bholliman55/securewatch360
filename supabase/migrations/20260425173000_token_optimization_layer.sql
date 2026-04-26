create table if not exists public.llm_prompt_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent text not null,
  task_type text not null,
  provider text not null,
  model text not null,
  prompt_hash text not null,
  prompt_preview text null,
  cache_hit boolean not null default false,
  used_summary boolean not null default false,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_prompt_tokens integer not null default 0,
  redaction_count integer not null default 0,
  compressed boolean not null default false,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_llm_prompt_logs_tenant_created
  on public.llm_prompt_logs (tenant_id, created_at desc);
create index if not exists idx_llm_prompt_logs_agent_task
  on public.llm_prompt_logs (tenant_id, agent, task_type);
create index if not exists idx_llm_prompt_logs_prompt_hash
  on public.llm_prompt_logs (tenant_id, prompt_hash);

create table if not exists public.llm_response_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent text not null,
  task_type text not null,
  prompt_hash text not null,
  response_text text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent, task_type, prompt_hash)
);

create index if not exists idx_llm_response_cache_tenant_expires
  on public.llm_response_cache (tenant_id, expires_at);

create table if not exists public.context_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent text not null,
  task_type text not null,
  context_hash text not null,
  summary_text text not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent, task_type, context_hash)
);

create index if not exists idx_context_summaries_tenant_expires
  on public.context_summaries (tenant_id, expires_at);

create table if not exists public.token_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent text not null,
  task_type text not null,
  max_prompt_tokens integer not null default 2500,
  max_completion_tokens integer not null default 400,
  max_total_tokens integer not null default 2900,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent, task_type)
);

create index if not exists idx_token_budgets_tenant_agent_task
  on public.token_budgets (tenant_id, agent, task_type);
