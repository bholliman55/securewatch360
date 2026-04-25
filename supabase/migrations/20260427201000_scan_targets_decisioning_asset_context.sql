-- Optional ownership / criticality context for scan targets, surfaced into finding decision_input.

alter table public.scan_targets
  add column if not exists owner_email text,
  add column if not exists business_criticality text;

comment on column public.scan_targets.owner_email is
  'Accountable contact email for this target; included in policy decision_input when set.';

comment on column public.scan_targets.business_criticality is
  'Relative business impact of the asset: low, medium, high, or critical; optional decisioning signal.';

alter table public.scan_targets drop constraint if exists scan_targets_business_criticality_check;

alter table public.scan_targets
  add constraint scan_targets_business_criticality_check
  check (
    business_criticality is null
    or business_criticality in ('low', 'medium', 'high', 'critical')
  );

create index if not exists scan_targets_tenant_business_criticality_idx
  on public.scan_targets (tenant_id, business_criticality)
  where business_criticality is not null;
