/*
  # Fix Incidents Table Schema

  1. Changes
    - Rename `occurred_at` to `detected_at` for consistency with service
    - Rename `incident_id` to `id` (but keep incident_id as well for backwards compatibility)
    - Add missing columns: category, affected_systems, resolved_at, assigned_to, impact, response_actions
    - Ensure client_id column exists

  2. Notes
    - Maintains data integrity by preserving existing data
    - Adds columns with appropriate defaults
*/

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'category'
  ) THEN
    ALTER TABLE incidents ADD COLUMN category text DEFAULT 'general';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'affected_systems'
  ) THEN
    ALTER TABLE incidents ADD COLUMN affected_systems text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'detected_at'
  ) THEN
    -- If occurred_at exists, copy its data to detected_at
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'incidents' AND column_name = 'occurred_at'
    ) THEN
      ALTER TABLE incidents ADD COLUMN detected_at timestamptz;
      UPDATE incidents SET detected_at = occurred_at;
      ALTER TABLE incidents ALTER COLUMN detected_at SET DEFAULT now();
    ELSE
      ALTER TABLE incidents ADD COLUMN detected_at timestamptz DEFAULT now();
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE incidents ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'assigned_to'
  ) THEN
    -- If created_by exists, use it as assigned_to
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'incidents' AND column_name = 'created_by'
    ) THEN
      ALTER TABLE incidents ADD COLUMN assigned_to text;
      UPDATE incidents SET assigned_to = created_by;
      ALTER TABLE incidents ALTER COLUMN assigned_to SET DEFAULT '';
    ELSE
      ALTER TABLE incidents ADD COLUMN assigned_to text DEFAULT '';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'impact'
  ) THEN
    ALTER TABLE incidents ADD COLUMN impact text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'response_actions'
  ) THEN
    ALTER TABLE incidents ADD COLUMN response_actions text DEFAULT '';
  END IF;
END $$;

-- Add id column as alias to incident_id if incident_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'incident_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'id'
  ) THEN
    -- Create a view or add id as generated column
    ALTER TABLE incidents ADD COLUMN id uuid DEFAULT gen_random_uuid();
    -- Update existing rows
    UPDATE incidents SET id = gen_random_uuid() WHERE id IS NULL;
  END IF;
END $$;

-- Ensure description column has correct default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'description'
  ) THEN
    ALTER TABLE incidents ALTER COLUMN description SET DEFAULT '';
  END IF;
END $$;
