-- Add internet_facing flag and manual_notes to asset_inventory for the
-- Assets Dashboard feature.

ALTER TABLE asset_inventory
  ADD COLUMN IF NOT EXISTS internet_facing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_asset_inventory_internet_facing
  ON asset_inventory (tenant_id, internet_facing);

COMMENT ON COLUMN asset_inventory.internet_facing IS
  'True when the asset is directly reachable from the public internet (e.g. has a public IP or a publicly-accessible FQDN).';

COMMENT ON COLUMN asset_inventory.notes IS
  'Free-form notes entered by analysts, e.g. ownership context or remediation notes.';
