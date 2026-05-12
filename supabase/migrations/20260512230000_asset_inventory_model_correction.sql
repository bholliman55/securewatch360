-- Asset inventory model correction.
--
-- Assets are owned technology inventory items (servers, workstations, domains,
-- cloud resources, owned applications).  Scan targets are scanner inputs (URLs,
-- IPs, CIDRs, hostnames, etc.) and are NOT automatically assets.
--
-- This migration:
--   1. Adds structured fields that belong to a technology asset record.
--   2. Adds validated enum columns for criticality, environment, and status.
--   3. Adds source linkage so a discovered asset can be traced back to the scan
--      run and scan target that found it.
--   4. Adds a NOT NULL default status so every asset row has a lifecycle state.

ALTER TABLE public.asset_inventory
  ADD COLUMN IF NOT EXISTS asset_name        text,
  ADD COLUMN IF NOT EXISTS hostname          text,
  ADD COLUMN IF NOT EXISTS ip_address        text,
  ADD COLUMN IF NOT EXISTS mac_address       text,
  ADD COLUMN IF NOT EXISTS operating_system  text,
  ADD COLUMN IF NOT EXISTS owner             text,
  ADD COLUMN IF NOT EXISTS location          text,
  ADD COLUMN IF NOT EXISTS environment       text,
  ADD COLUMN IF NOT EXISTS criticality       text,
  ADD COLUMN IF NOT EXISTS source            text,
  ADD COLUMN IF NOT EXISTS source_scan_id    uuid,
  ADD COLUMN IF NOT EXISTS source_scan_target_id uuid,
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.asset_inventory.asset_name IS
  'Human-readable name for the asset (e.g. "prod-web-01"). Falls back to display_name / asset_identifier if not set.';
COMMENT ON COLUMN public.asset_inventory.hostname IS 'DNS hostname of this asset.';
COMMENT ON COLUMN public.asset_inventory.ip_address IS 'Primary IP address of this asset.';
COMMENT ON COLUMN public.asset_inventory.mac_address IS 'MAC address, if known.';
COMMENT ON COLUMN public.asset_inventory.operating_system IS 'OS name/version (e.g. "Ubuntu 24.04 LTS").';
COMMENT ON COLUMN public.asset_inventory.owner IS 'Team or person responsible for this asset.';
COMMENT ON COLUMN public.asset_inventory.location IS 'Physical or logical location (datacenter, region, site).';
COMMENT ON COLUMN public.asset_inventory.environment IS 'Deployment environment: production, staging, development, testing, other.';
COMMENT ON COLUMN public.asset_inventory.criticality IS 'Business criticality: critical, high, medium, low.';
COMMENT ON COLUMN public.asset_inventory.source IS 'How the asset was discovered or added (e.g. "scan", "manual", "cmdb_import").';
COMMENT ON COLUMN public.asset_inventory.source_scan_id IS 'FK to the scan run that first discovered or last confirmed this asset.';
COMMENT ON COLUMN public.asset_inventory.source_scan_target_id IS 'FK to the scan target that produced this asset record.';
COMMENT ON COLUMN public.asset_inventory.status IS 'Lifecycle status: active, inactive, decommissioned.';

-- Foreign keys for scan linkage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_inventory_source_scan_id_fkey'
      AND conrelid = 'public.asset_inventory'::regclass
  ) THEN
    ALTER TABLE public.asset_inventory
      ADD CONSTRAINT asset_inventory_source_scan_id_fkey
      FOREIGN KEY (source_scan_id) REFERENCES public.scan_runs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_inventory_source_scan_target_id_fkey'
      AND conrelid = 'public.asset_inventory'::regclass
  ) THEN
    ALTER TABLE public.asset_inventory
      ADD CONSTRAINT asset_inventory_source_scan_target_id_fkey
      FOREIGN KEY (source_scan_target_id) REFERENCES public.scan_targets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Check constraints for enum-like columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_inventory_status_check'
      AND conrelid = 'public.asset_inventory'::regclass
  ) THEN
    ALTER TABLE public.asset_inventory
      ADD CONSTRAINT asset_inventory_status_check
      CHECK (status IN ('active', 'inactive', 'decommissioned'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_inventory_criticality_check'
      AND conrelid = 'public.asset_inventory'::regclass
  ) THEN
    ALTER TABLE public.asset_inventory
      ADD CONSTRAINT asset_inventory_criticality_check
      CHECK (criticality IS NULL OR criticality IN ('critical', 'high', 'medium', 'low'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_inventory_environment_check'
      AND conrelid = 'public.asset_inventory'::regclass
  ) THEN
    ALTER TABLE public.asset_inventory
      ADD CONSTRAINT asset_inventory_environment_check
      CHECK (environment IS NULL OR environment IN ('production', 'staging', 'development', 'testing', 'other'));
  END IF;
END $$;

-- Indexes on the new lookup / filter columns
CREATE INDEX IF NOT EXISTS asset_inventory_status_idx
  ON public.asset_inventory (tenant_id, status);

CREATE INDEX IF NOT EXISTS asset_inventory_criticality_idx
  ON public.asset_inventory (tenant_id, criticality);

CREATE INDEX IF NOT EXISTS asset_inventory_source_scan_idx
  ON public.asset_inventory (source_scan_id);

CREATE INDEX IF NOT EXISTS asset_inventory_source_scan_target_idx
  ON public.asset_inventory (source_scan_target_id);

-- Backfill source_scan_target_id from findings.scan_target_id where available.
-- (Best-effort; only possible for rows where asset_identifier matches target_value.)
UPDATE public.asset_inventory ai
SET source_scan_target_id = st.id
FROM public.scan_targets st
WHERE st.tenant_id = ai.tenant_id
  AND st.target_value = ai.asset_identifier
  AND ai.source_scan_target_id IS NULL;
