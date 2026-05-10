-- Posture Roadmap: stores per-tenant roadmap items and target framework config.

-- Table: posture_target_config
-- Stores each tenant's chosen target compliance framework.
CREATE TABLE IF NOT EXISTS posture_target_config (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_framework text      NOT NULL DEFAULT 'CMMC_L2',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Table: posture_roadmap_items
-- Each row is a prioritized remediation/improvement action for a tenant.
CREATE TABLE IF NOT EXISTS posture_roadmap_items (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                  text        NOT NULL,
  category               text        NOT NULL CHECK (category IN (
    'identity_access', 'endpoint_security', 'network_security',
    'vulnerability_management', 'backup_recovery', 'monitoring_logging',
    'compliance_evidence', 'security_awareness', 'incident_response'
  )),
  related_framework      text,
  current_state          text,
  desired_state          text,
  priority               text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  estimated_effort       text        NOT NULL DEFAULT 'medium' CHECK (estimated_effort IN ('low', 'medium', 'high')),
  estimated_impact_score integer     NOT NULL DEFAULT 50 CHECK (estimated_impact_score BETWEEN 0 AND 100),
  recommended_action     text,
  automation_level       text        NOT NULL DEFAULT 'not_yet' CHECK (automation_level IN ('now', 'later', 'not_yet')),
  status                 text        NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'deferred')),
  sort_order             integer     NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS posture_roadmap_items_tenant_id_idx ON posture_roadmap_items(tenant_id);
CREATE INDEX IF NOT EXISTS posture_roadmap_items_priority_idx   ON posture_roadmap_items(tenant_id, priority);
CREATE INDEX IF NOT EXISTS posture_roadmap_items_status_idx     ON posture_roadmap_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS posture_target_config_tenant_id_idx  ON posture_target_config(tenant_id);

-- Auto-update updated_at on posture_roadmap_items
CREATE OR REPLACE FUNCTION set_posture_roadmap_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER posture_roadmap_items_updated_at
  BEFORE UPDATE ON posture_roadmap_items
  FOR EACH ROW EXECUTE FUNCTION set_posture_roadmap_updated_at();

-- RLS
ALTER TABLE posture_roadmap_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE posture_target_config  ENABLE ROW LEVEL SECURITY;

-- posture_roadmap_items: tenant members can read; owners/admins can write
CREATE POLICY posture_roadmap_items_select ON posture_roadmap_items
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY posture_roadmap_items_insert ON posture_roadmap_items
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );

CREATE POLICY posture_roadmap_items_update ON posture_roadmap_items
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );

CREATE POLICY posture_roadmap_items_delete ON posture_roadmap_items
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- posture_target_config: tenant members can read; owners/admins can write
CREATE POLICY posture_target_config_select ON posture_target_config
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY posture_target_config_insert ON posture_target_config
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );

CREATE POLICY posture_target_config_update ON posture_target_config
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );
