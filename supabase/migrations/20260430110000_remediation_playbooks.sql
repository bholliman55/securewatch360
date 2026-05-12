-- Add AI-generated playbook column to remediation_actions
ALTER TABLE remediation_actions
  ADD COLUMN IF NOT EXISTS playbook jsonb;

-- playbook shape:
-- {
--   "steps": string[],
--   "estimatedEffort": "< 1 hour" | "1-4 hours" | "1 day" | "1 week+",
--   "requiredRole": string,
--   "automatable": boolean,
--   "generatedAt": string
-- }

CREATE INDEX IF NOT EXISTS remediation_actions_playbook_null_idx
  ON remediation_actions ((playbook IS NULL))
  WHERE playbook IS NULL;
