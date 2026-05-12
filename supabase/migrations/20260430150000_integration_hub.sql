-- Integration hub: per-tenant connector configs and sync state
CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_type text NOT NULL, -- 'jira' | 'servicenow' | 'slack'
  config jsonb NOT NULL DEFAULT '{}', -- encrypted/redacted at app layer
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_type)
);

-- Tracks synced external tickets back to remediation actions
CREATE TABLE IF NOT EXISTS integration_sync_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  local_resource_type text NOT NULL, -- 'remediation_action' | 'finding'
  local_resource_id uuid NOT NULL,
  external_id text NOT NULL,
  external_url text,
  sync_state text NOT NULL DEFAULT 'open', -- 'open' | 'closed' | 'error'
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_type, local_resource_id)
);

ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_configs_tenant" ON integration_configs FOR ALL USING (tenant_id = auth.uid());
CREATE POLICY "integration_sync_records_tenant" ON integration_sync_records FOR ALL USING (tenant_id = auth.uid());
