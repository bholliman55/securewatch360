-- External assets discovered by Agent 1 (attack surface discovery)
CREATE TABLE IF NOT EXISTS external_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       text,
  client_id     text,
  domain        text        NOT NULL,
  asset_type    text        NOT NULL,
  asset_value   text        NOT NULL,
  source        text,
  confidence    numeric(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  risk_hint     text,
  discovered_at timestamptz DEFAULT now(),
  raw           jsonb,
  created_at    timestamptz DEFAULT now()
);

-- Dedupe: same domain + asset_type + asset_value is one asset
CREATE UNIQUE INDEX IF NOT EXISTS external_assets_dedupe_idx
  ON external_assets (domain, asset_type, asset_value);

CREATE INDEX IF NOT EXISTS external_assets_domain_idx       ON external_assets (domain);
CREATE INDEX IF NOT EXISTS external_assets_client_id_idx    ON external_assets (client_id);
CREATE INDEX IF NOT EXISTS external_assets_scan_id_idx      ON external_assets (scan_id);
CREATE INDEX IF NOT EXISTS external_assets_asset_type_idx   ON external_assets (asset_type);
CREATE INDEX IF NOT EXISTS external_assets_created_at_idx   ON external_assets (created_at DESC);


-- OSINT and threat intelligence events collected by Agent 2
CREATE TABLE IF NOT EXISTS external_intelligence_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id          text,
  client_id        text,
  domain           text,
  company_name     text,
  event_type       text        NOT NULL,
  severity         text        NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  confidence       numeric(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  source_category  text,
  evidence_url     text,
  redacted_preview text,
  first_seen       timestamptz,
  last_seen        timestamptz,
  raw              jsonb,
  created_at       timestamptz DEFAULT now()
);

-- Dedupe: same domain + event_type + evidence_url is one event
CREATE UNIQUE INDEX IF NOT EXISTS external_intel_dedupe_idx
  ON external_intelligence_events (domain, event_type, COALESCE(evidence_url, ''));

CREATE INDEX IF NOT EXISTS external_intel_domain_idx       ON external_intelligence_events (domain);
CREATE INDEX IF NOT EXISTS external_intel_client_id_idx    ON external_intelligence_events (client_id);
CREATE INDEX IF NOT EXISTS external_intel_scan_id_idx      ON external_intelligence_events (scan_id);
CREATE INDEX IF NOT EXISTS external_intel_severity_idx     ON external_intelligence_events (severity);
CREATE INDEX IF NOT EXISTS external_intel_event_type_idx   ON external_intelligence_events (event_type);
CREATE INDEX IF NOT EXISTS external_intel_created_at_idx   ON external_intelligence_events (created_at DESC);
