-- Sync policy_framework_controls (full policy pack catalog) into control_requirements
-- so compliance_agent finding_control_mappings can resolve UUIDs by (framework, control_code).
-- Idempotent: upserts title/description from the deployment catalog.

insert into public.control_requirements (framework_id, control_code, title, description)
select
  cf.id,
  pfc.control_code,
  pfc.policy_title,
  left(pfc.policy_body, 20000)
from public.policy_framework_controls pfc
join public.policy_framework_profiles pfp on pfp.id = pfc.profile_id
join public.control_frameworks cf on cf.framework_code = pfp.framework_code
on conflict (framework_id, control_code) do update
set
  title = excluded.title,
  description = excluded.description;
