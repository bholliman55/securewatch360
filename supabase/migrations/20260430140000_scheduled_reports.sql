-- Scheduled compliance reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  framework text NOT NULL,
  format text NOT NULL DEFAULT 'html',
  cron_expression text NOT NULL DEFAULT '0 8 * * 1',
  recipients jsonb NOT NULL DEFAULT '[]',
  last_run_at timestamptz,
  next_run_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_reports_tenant_isolation" ON scheduled_reports
  FOR ALL USING (tenant_id = auth.uid());
