-- Add agent_type and asset_id traceability columns to findings.
--
-- agent_type: scanner adapter family ("web", "network", "vulnerability", "mock") that
--   produced this finding. Derived from scan_runs.scanner_type at insert time.
-- asset_id: FK to asset_inventory, linking a finding to a known asset record.
--   Populated by the scan workflow when it upserts the scan target into asset_inventory.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS agent_type text,
  ADD COLUMN IF NOT EXISTS asset_id uuid;

COMMENT ON COLUMN public.findings.agent_type IS
  'Scanner adapter family (e.g. web, network, vulnerability, mock) that produced this finding. Derived from scan_runs.scanner_type.';

COMMENT ON COLUMN public.findings.asset_id IS
  'FK to asset_inventory record associated with this finding. Populated when the scan target is upserted into asset_inventory during scan workflow execution.';

-- FK to asset_inventory (nullable; set null when the asset record is removed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'findings_asset_id_fkey'
      AND conrelid = 'public.findings'::regclass
  ) THEN
    ALTER TABLE public.findings
      ADD CONSTRAINT findings_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES public.asset_inventory(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill agent_type from scan_runs.scanner_type for already-stored findings
UPDATE public.findings f
SET agent_type = sr.scanner_type
FROM public.scan_runs sr
WHERE sr.id = f.scan_run_id
  AND sr.scanner_type IS NOT NULL
  AND f.agent_type IS NULL;

-- Indexes for the new filter columns
CREATE INDEX IF NOT EXISTS findings_agent_type_idx ON public.findings (tenant_id, agent_type);
CREATE INDEX IF NOT EXISTS findings_asset_id_idx   ON public.findings (tenant_id, asset_id);

-- Replace the traceability trigger function so it also back-fills agent_type
-- from scan_runs.scanner_type when a finding is inserted without one.
CREATE OR REPLACE FUNCTION public.set_finding_scan_traceability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_scan_target_id uuid;
  v_scanner_type   text;
BEGIN
  IF new.scan_run_id IS NOT NULL THEN
    new.scan_id        := COALESCE(new.scan_id, new.scan_run_id);
    new.scan_result_id := COALESCE(new.scan_result_id, new.scan_run_id);

    -- Fetch scan_target_id and scanner_type from the run when either is missing
    IF new.scan_target_id IS NULL OR new.agent_type IS NULL THEN
      SELECT sr.scan_target_id, sr.scanner_type
        INTO v_scan_target_id, v_scanner_type
        FROM public.scan_runs sr
       WHERE sr.id = new.scan_run_id;

      IF new.scan_target_id IS NULL THEN
        new.scan_target_id := v_scan_target_id;
      END IF;
      IF new.agent_type IS NULL THEN
        new.agent_type := v_scanner_type;
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- Recreate the trigger (adds agent_type to the UPDATE column list)
DROP TRIGGER IF EXISTS findings_scan_traceability_before_write ON public.findings;

CREATE TRIGGER findings_scan_traceability_before_write
BEFORE INSERT OR UPDATE OF scan_run_id, scan_id, scan_result_id, scan_target_id, agent_type
ON public.findings
FOR EACH ROW
EXECUTE FUNCTION public.set_finding_scan_traceability();
