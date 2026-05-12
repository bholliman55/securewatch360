-- Add explicit scan traceability aliases for scanner/vulnerability UI compatibility.
-- `scan_run_id` remains the canonical occurrence link; these nullable columns
-- make scan source filters and older scan_result naming explicit without
-- duplicating finding records.

alter table public.findings
  add column if not exists scan_id uuid,
  add column if not exists scan_result_id uuid,
  add column if not exists scan_target_id uuid;

update public.findings
set
  scan_id = coalesce(scan_id, scan_run_id),
  scan_result_id = coalesce(scan_result_id, scan_run_id)
where scan_run_id is not null
  and (scan_id is null or scan_result_id is null);

update public.findings f
set scan_target_id = sr.scan_target_id
from public.scan_runs sr
where f.scan_run_id = sr.id
  and f.scan_target_id is null
  and sr.scan_target_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'findings_scan_id_fkey'
  ) then
    alter table public.findings
      add constraint findings_scan_id_fkey
      foreign key (scan_id) references public.scan_runs (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'findings_scan_result_id_fkey'
  ) then
    alter table public.findings
      add constraint findings_scan_result_id_fkey
      foreign key (scan_result_id) references public.scan_runs (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'findings_scan_target_id_fkey'
  ) then
    alter table public.findings
      add constraint findings_scan_target_id_fkey
      foreign key (scan_target_id) references public.scan_targets (id) on delete set null;
  end if;
end $$;

create index if not exists findings_scan_id_idx on public.findings (scan_id);
create index if not exists findings_scan_result_id_idx on public.findings (scan_result_id);
create index if not exists findings_scan_target_id_idx on public.findings (scan_target_id);
create index if not exists findings_tenant_scan_id_idx on public.findings (tenant_id, scan_id);
create index if not exists findings_tenant_scan_result_id_idx on public.findings (tenant_id, scan_result_id);
