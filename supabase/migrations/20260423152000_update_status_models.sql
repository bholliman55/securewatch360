-- SecureWatch360 v1.2: normalize scan run and finding statuses
-- Backward-compatible migration from older v1 status values.

-- 1) Map existing scan_runs statuses
update public.scan_runs
set status = case status
  when 'pending' then 'queued'
  when 'succeeded' then 'completed'
  else status
end
where status in ('pending', 'succeeded');

-- 2) Map existing findings statuses
update public.findings
set status = case status
  when 'new' then 'open'
  when 'false_positive' then 'risk_accepted'
  else status
end
where status in ('new', 'false_positive');

-- 3) Update defaults
alter table public.scan_runs
  alter column status set default 'queued';

alter table public.findings
  alter column status set default 'open';

-- 4) Replace check constraints
alter table public.scan_runs
  drop constraint if exists scan_runs_status_check;

alter table public.findings
  drop constraint if exists findings_status_check;

alter table public.scan_runs
  add constraint scan_runs_status_check
  check (status in ('queued', 'running', 'completed', 'failed', 'cancelled'));

alter table public.findings
  add constraint findings_status_check
  check (status in ('open', 'acknowledged', 'in_progress', 'resolved', 'risk_accepted'));
