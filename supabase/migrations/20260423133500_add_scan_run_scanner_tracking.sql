-- SecureWatch360 v1.1: scanner execution tracking on scan_runs
-- Backward-compatible migration using ALTER TABLE.

alter table public.scan_runs
  add column if not exists scanner_name text,
  add column if not exists scanner_type text,
  add column if not exists target_snapshot jsonb,
  add column if not exists result_summary jsonb;

comment on column public.scan_runs.scanner_name is
  'Human-readable scanner label used for the run (e.g. Mock Scanner, Nmap, OWASP ZAP).';

comment on column public.scan_runs.scanner_type is
  'Scanner family/type used for the run (e.g. mock, network, web, vulnerability).';

comment on column public.scan_runs.target_snapshot is
  'Immutable JSON snapshot of target details used at run start, so later target edits do not change historical run context.';

comment on column public.scan_runs.result_summary is
  'Compact JSON summary of run output (counts, scanner metadata, and key execution notes) for quick reads/debugging without loading all findings.';

-- Useful lightweight indexes for v1 dashboards and filtering.
create index if not exists scan_runs_scanner_name_idx on public.scan_runs (scanner_name);
create index if not exists scan_runs_scanner_type_idx on public.scan_runs (scanner_type);

-- Optional JSON querying support (safe for v1; can be removed later if unused).
create index if not exists scan_runs_target_snapshot_gin_idx
  on public.scan_runs using gin (target_snapshot);

create index if not exists scan_runs_result_summary_gin_idx
  on public.scan_runs using gin (result_summary);
