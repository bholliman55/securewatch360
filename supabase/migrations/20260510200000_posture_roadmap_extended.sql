-- Extended posture assessment and scoring tables.
-- Adds posture_assessments, framework_readiness_scores, posture_gaps,
-- posture_roadmap_action_items (distinct from posture_roadmap_items), and
-- posture_score_history.

-- Reuse (or re-create) the generic set_updated_at trigger function.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posture_assessments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id            uuid,
  assessment_name      text,
  overall_score        numeric,
  maturity_level       text,
  target_framework     text,
  target_score         numeric,
  readiness_percentage numeric,
  summary              text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS framework_readiness_scores (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id        uuid        NOT NULL REFERENCES posture_assessments(id) ON DELETE CASCADE,
  framework            text        NOT NULL,
  readiness_percentage numeric     NOT NULL,
  current_score        numeric,
  target_score         numeric,
  status               text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posture_gaps (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id        uuid        NOT NULL REFERENCES posture_assessments(id) ON DELETE CASCADE,
  category             text        NOT NULL,
  framework            text        NOT NULL,
  control_id           text,
  control_name         text,
  current_state        text,
  desired_state        text,
  gap_description      text,
  severity             text        CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  evidence_source      text,
  related_asset_id     uuid,
  related_finding_id   uuid,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- NOTE: Named posture_roadmap_action_items (not posture_roadmap_items) to avoid
-- conflict with the simpler tenant-scoped table created in the prior migration.
CREATE TABLE IF NOT EXISTS posture_roadmap_action_items (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id           uuid        NOT NULL REFERENCES posture_assessments(id) ON DELETE CASCADE,
  title                   text        NOT NULL,
  category                text        NOT NULL,
  framework               text        NOT NULL,
  priority                text        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  estimated_effort        text        CHECK (estimated_effort IN ('low', 'medium', 'high')),
  estimated_impact_score  numeric,
  current_state           text,
  desired_state           text,
  recommended_action      text,
  automation_status       text        CHECK (automation_status IN ('available_now', 'planned', 'manual_only')),
  securewatch_agent       text,
  status                  text        CHECK (status IN ('not_started', 'in_progress', 'completed', 'deferred')) DEFAULT 'not_started',
  sort_order              integer,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posture_score_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        uuid,
  assessment_id    uuid        REFERENCES posture_assessments(id) ON DELETE SET NULL,
  overall_score    numeric,
  cis_v8_score     numeric,
  nist_csf_score   numeric,
  cmmc_l1_score    numeric,
  cmmc_l2_score    numeric,
  hipaa_score      numeric,
  soc2_score       numeric,
  recorded_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS posture_assessments_tenant_id_idx
  ON posture_assessments (tenant_id);
CREATE INDEX IF NOT EXISTS posture_assessments_client_id_idx
  ON posture_assessments (client_id);

CREATE INDEX IF NOT EXISTS framework_readiness_scores_assessment_id_idx
  ON framework_readiness_scores (assessment_id);
CREATE INDEX IF NOT EXISTS framework_readiness_scores_framework_idx
  ON framework_readiness_scores (framework);

CREATE INDEX IF NOT EXISTS posture_gaps_assessment_id_idx
  ON posture_gaps (assessment_id);
CREATE INDEX IF NOT EXISTS posture_gaps_framework_idx
  ON posture_gaps (framework);
CREATE INDEX IF NOT EXISTS posture_gaps_severity_idx
  ON posture_gaps (severity);

CREATE INDEX IF NOT EXISTS posture_roadmap_action_items_assessment_id_idx
  ON posture_roadmap_action_items (assessment_id);
CREATE INDEX IF NOT EXISTS posture_roadmap_action_items_priority_idx
  ON posture_roadmap_action_items (priority);
CREATE INDEX IF NOT EXISTS posture_roadmap_action_items_status_idx
  ON posture_roadmap_action_items (status);

CREATE INDEX IF NOT EXISTS posture_score_history_tenant_id_idx
  ON posture_score_history (tenant_id);
CREATE INDEX IF NOT EXISTS posture_score_history_client_id_idx
  ON posture_score_history (client_id);
CREATE INDEX IF NOT EXISTS posture_score_history_assessment_id_idx
  ON posture_score_history (assessment_id);
CREATE INDEX IF NOT EXISTS posture_score_history_recorded_at_idx
  ON posture_score_history (recorded_at);

-- ─── updated_at triggers ──────────────────────────────────────────────────────

CREATE TRIGGER posture_assessments_updated_at
  BEFORE UPDATE ON posture_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER posture_roadmap_action_items_updated_at
  BEFORE UPDATE ON posture_roadmap_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE posture_assessments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_readiness_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE posture_gaps                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE posture_roadmap_action_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE posture_score_history         ENABLE ROW LEVEL SECURITY;

-- posture_assessments ──────────────────────────────────────────────────────────

CREATE POLICY posture_assessments_select ON posture_assessments
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY posture_assessments_insert ON posture_assessments
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );

CREATE POLICY posture_assessments_update ON posture_assessments
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );

CREATE POLICY posture_assessments_delete ON posture_assessments
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- framework_readiness_scores ───────────────────────────────────────────────────

CREATE POLICY framework_readiness_scores_select ON framework_readiness_scores
  FOR SELECT USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY framework_readiness_scores_insert ON framework_readiness_scores
  FOR INSERT WITH CHECK (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
      )
    )
  );

CREATE POLICY framework_readiness_scores_update ON framework_readiness_scores
  FOR UPDATE USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
      )
    )
  );

CREATE POLICY framework_readiness_scores_delete ON framework_readiness_scores
  FOR DELETE USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- posture_gaps ─────────────────────────────────────────────────────────────────

CREATE POLICY posture_gaps_select ON posture_gaps
  FOR SELECT USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY posture_gaps_insert ON posture_gaps
  FOR INSERT WITH CHECK (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
      )
    )
  );

CREATE POLICY posture_gaps_update ON posture_gaps
  FOR UPDATE USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
      )
    )
  );

CREATE POLICY posture_gaps_delete ON posture_gaps
  FOR DELETE USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- posture_roadmap_action_items ─────────────────────────────────────────────────

CREATE POLICY posture_roadmap_action_items_select ON posture_roadmap_action_items
  FOR SELECT USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY posture_roadmap_action_items_insert ON posture_roadmap_action_items
  FOR INSERT WITH CHECK (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
      )
    )
  );

CREATE POLICY posture_roadmap_action_items_update ON posture_roadmap_action_items
  FOR UPDATE USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
      )
    )
  );

CREATE POLICY posture_roadmap_action_items_delete ON posture_roadmap_action_items
  FOR DELETE USING (
    assessment_id IN (
      SELECT id FROM posture_assessments
      WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- posture_score_history ────────────────────────────────────────────────────────
-- Immutable history: no DELETE policy.

CREATE POLICY posture_score_history_select ON posture_score_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY posture_score_history_insert ON posture_score_history
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'analyst')
    )
  );
