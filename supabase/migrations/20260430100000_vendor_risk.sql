-- Vendor risk assessment tables

CREATE TABLE IF NOT EXISTS vendor_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  vendor_domain text,
  risk_tier text CHECK (risk_tier IN ('critical', 'high', 'medium', 'low')),
  overall_score numeric(5, 2) DEFAULT 0,
  signal_count integer DEFAULT 0,
  last_assessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, vendor_name)
);

CREATE TABLE IF NOT EXISTS vendor_risk_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_assessment_id uuid NOT NULL REFERENCES vendor_assessments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL,
  confidence numeric(3, 2),
  source_category text,
  evidence_url text,
  redacted_preview text,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  raw jsonb
);

CREATE INDEX IF NOT EXISTS vendor_assessments_tenant_id_idx ON vendor_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS vendor_assessments_risk_tier_idx ON vendor_assessments(risk_tier);
CREATE INDEX IF NOT EXISTS vendor_risk_signals_assessment_id_idx ON vendor_risk_signals(vendor_assessment_id);
CREATE INDEX IF NOT EXISTS vendor_risk_signals_tenant_id_idx ON vendor_risk_signals(tenant_id);

ALTER TABLE vendor_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_risk_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_assessments_tenant_isolation ON vendor_assessments
  USING (tenant_id = auth.uid());

CREATE POLICY vendor_risk_signals_tenant_isolation ON vendor_risk_signals
  USING (tenant_id = auth.uid());
