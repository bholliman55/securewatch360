-- Posture Roadmap gap-fill migration.
-- The base tables were created in:
--   20260510190000_posture_roadmap.sql          (posture_roadmap_items, posture_target_config)
--   20260510200000_posture_roadmap_extended.sql (posture_assessments, framework_readiness_scores,
--                                                posture_gaps, posture_roadmap_action_items,
--                                                posture_score_history)
--
-- This migration adds the columns present in the product spec that were omitted from those
-- migrations, and creates a view alias so product code can reference the expected table name.

-- ─── Missing columns ──────────────────────────────────────────────────────────

ALTER TABLE posture_assessments
  ADD COLUMN IF NOT EXISTS is_estimated boolean NOT NULL DEFAULT false;

ALTER TABLE framework_readiness_scores
  ADD COLUMN IF NOT EXISTS top_gap text;

ALTER TABLE posture_gaps
  ADD COLUMN IF NOT EXISTS is_estimated boolean NOT NULL DEFAULT false;

-- posture_roadmap_action_items is the assessment-scoped roadmap table.
-- The name posture_roadmap_items was already taken by the simpler tenant-scoped table
-- from the first migration; see the view alias below.
ALTER TABLE posture_roadmap_action_items
  ADD COLUMN IF NOT EXISTS roadmap_bucket text
    CHECK (roadmap_bucket IN ('fix_first', 'next_30_days', 'next_60_days', 'next_90_days'));

-- ─── Supplemental index ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS posture_roadmap_action_items_roadmap_bucket_idx
  ON posture_roadmap_action_items (roadmap_bucket);

-- ─── View alias ───────────────────────────────────────────────────────────────
-- Provides the expected product-layer name (posture_roadmap_items) while the underlying
-- table remains posture_roadmap_action_items to avoid collision with the earlier
-- tenant-scoped table of the same name.
-- NOTE: RLS policies are enforced on the base table; this view inherits them.
CREATE OR REPLACE VIEW posture_roadmap_items_v AS
  SELECT * FROM posture_roadmap_action_items;

COMMENT ON VIEW posture_roadmap_items_v IS
  'Assessment-scoped roadmap items. Alias for posture_roadmap_action_items. '
  'The table name posture_roadmap_items is taken by the legacy tenant-scoped table '
  'from 20260510190000_posture_roadmap.sql.';
