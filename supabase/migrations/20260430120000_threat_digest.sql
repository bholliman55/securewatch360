-- Threat digest storage (one per tenant, overwritten weekly)
CREATE TABLE IF NOT EXISTS tenant_threat_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  digest jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE tenant_threat_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_threat_digests_tenant_isolation" ON tenant_threat_digests
  FOR ALL USING (tenant_id = auth.uid());
