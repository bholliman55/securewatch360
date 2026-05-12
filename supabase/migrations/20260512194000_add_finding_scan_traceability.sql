-- Add explicit scan trace columns to findings while preserving scan_run_id as
-- the canonical occurrence relationship.

alter table public.findings
  add column if not exists scan_id uuid,
  add column if not exists scan_result_id uuid,
  add column if not exists scan_target_id uuid;

comment on column public.findings.scan_id is
  'Compatibility alias for the scan run that produced this finding. Mirrors scan_run_id for scan-originated rows.';

comment on column public.findings.scan_result_id is
  'Compatibility alias for scan result/run detail views. Mirrors scan_run_id for scan-originated rows.';

comment on column public.findings.scan_target_id is
  'Direct reference to the target scanned when this finding was produced, denormalized from scan_runs for filtering and UI traceability.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'findings_scan_id_fkey'
      and conrelid = 'public.findings'::regclass
  ) then
    alter table public.findings
      add constraint findings_scan_id_fkey
      foreign key (scan_id) references public.scan_runs (id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'findings_scan_result_id_fkey'
      and conrelid = 'public.findings'::regclass
  ) then
    alter table public.findings
      add constraint findings_scan_result_id_fkey
      foreign key (scan_result_id) references public.scan_runs (id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'findings_scan_target_id_fkey'
      and conrelid = 'public.findings'::regclass
  ) then
    alter table public.findings
      add constraint findings_scan_target_id_fkey
      foreign key (scan_target_id) references public.scan_targets (id) on delete set null;
  end if;
end $$;

update public.findings f
set
  scan_id = coalesce(f.scan_id, f.scan_run_id),
  scan_result_id = coalesce(f.scan_result_id, f.scan_run_id),
  scan_target_id = coalesce(f.scan_target_id, sr.scan_target_id)
from public.scan_runs sr
where sr.id = f.scan_run_id
  and (f.scan_id is null or f.scan_result_id is null or f.scan_target_id is null);

create index if not exists findings_scan_id_idx on public.findings (scan_id);
create index if not exists findings_scan_result_id_idx on public.findings (scan_result_id);
create index if not exists findings_scan_target_id_idx on public.findings (scan_target_id);

create or replace function public.set_finding_scan_traceability()
returns trigger
language plpgsql
as $$
begin
  if new.scan_run_id is not null then
    new.scan_id := coalesce(new.scan_id, new.scan_run_id);
    new.scan_result_id := coalesce(new.scan_result_id, new.scan_run_id);

    if new.scan_target_id is null then
      select sr.scan_target_id
      into new.scan_target_id
      from public.scan_runs sr
      where sr.id = new.scan_run_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists findings_scan_traceability_before_write on public.findings;

create trigger findings_scan_traceability_before_write
before insert or update of scan_run_id, scan_id, scan_result_id, scan_target_id
on public.findings
for each row
execute function public.set_finding_scan_traceability();
