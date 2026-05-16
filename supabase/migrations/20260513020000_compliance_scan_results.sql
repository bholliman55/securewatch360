-- compliance_scan_results: per-control output from compliance scan runs.
-- Each row represents one control evaluated during a compliance scan.
-- Populated by the scan-tenant workflow after the compliance adapter runs.

CREATE TABLE IF NOT EXISTS compliance_scan_results (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scan_run_id         UUID        NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  framework           TEXT        NOT NULL,
  control_id          TEXT        NOT NULL,
  control_name        TEXT        NOT NULL,
  status              TEXT        NOT NULL CHECK (
                        status IN ('pass', 'fail', 'partial', 'unknown', 'evidence_missing')
                      ),
  evidence            JSONB       NOT NULL DEFAULT '{}',
  gap                 TEXT,
  recommended_action  TEXT,
  severity            TEXT        NOT NULL DEFAULT 'info' CHECK (
                        severity IN ('info', 'low', 'medium', 'high', 'critical')
                      ),
  related_asset_id    UUID        REFERENCES asset_inventory(id) ON DELETE SET NULL,
  related_finding_id  UUID        REFERENCES findings(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csr_tenant
  ON compliance_scan_results (tenant_id);
CREATE INDEX IF NOT EXISTS idx_csr_scan_run
  ON compliance_scan_results (scan_run_id);
CREATE INDEX IF NOT EXISTS idx_csr_framework
  ON compliance_scan_results (tenant_id, framework);
CREATE INDEX IF NOT EXISTS idx_csr_status
  ON compliance_scan_results (tenant_id, framework, status);
