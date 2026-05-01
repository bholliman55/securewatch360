-- Remediation display fields for ITSM sync and execution audit (idempotent).
alter table public.remediation_actions
  add column if not exists title text;
alter table public.remediation_actions
  add column if not exists description text;

comment on column public.remediation_actions.title is
  'Human-readable title (optional; may be backfilled from finding or integration).';
comment on column public.remediation_actions.description is
  'Details for tickets and playbooks.';
