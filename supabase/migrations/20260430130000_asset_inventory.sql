-- Asset inventory catalog built from scan runs
CREATE TABLE IF NOT EXISTS asset_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_identifier text NOT NULL,
  asset_type text NOT NULL,
  display_name text,
  metadata jsonb NOT NULL DEFAULT '{}',
  finding_count int NOT NULL DEFAULT 0,
  critical_count int NOT NULL DEFAULT 0,
  high_count int NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asset_identifier)
);

CREATE INDEX IF NOT EXISTS asset_inventory_tenant_type ON asset_inventory(tenant_id, asset_type);
CREATE INDEX IF NOT EXISTS asset_inventory_tenant_findings ON asset_inventory(tenant_id, finding_count DESC);

ALTER TABLE asset_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_inventory_tenant_isolation" ON asset_inventory
  FOR ALL USING (tenant_id = auth.uid());
