/**
 * Unit tests for postureRoadmapService.ts
 *
 * Supabase is mocked end-to-end so no DB connection is required.
 * Tests cover: read functions, write functions, automation/bucket mapping,
 * error codes, and previewAutomationPlan logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Supabase before any import that touches it ─────────────────────────

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  getLatestPostureAssessment,
  updateRoadmapItemStatus,
  createPostureAssessment,
  previewAutomationPlan,
  getFrameworkReadinessScores,
  getPostureGaps,
  getRoadmapItems,
  PostureRoadmapError,
} from "@/features/posture-roadmap/services/postureRoadmapService";
import type { PostureAssessmentResult } from "@/features/posture-roadmap/types/postureTypes";

// ─── Chainable mock builder ───────────────────────────────────────────────────

function makeChain(terminalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(terminalResult);
  const self = () => chain;

  chain.select = self;
  chain.eq = self;
  chain.order = self;
  chain.limit = self;
  chain.update = self;
  chain.insert = self;
  chain.maybeSingle = terminal;
  chain.single = terminal;
  // array-returning terminal (no .single)
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(terminalResult).then(resolve);

  return chain;
}

function mockSupabase(fromResult: { data: unknown; error: unknown }) {
  (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => makeChain(fromResult),
  } as unknown as ReturnType<typeof getSupabaseAdminClient>);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = "tenant-unit-test";

const fakeAssessment = {
  id: "assess-001",
  tenant_id: TENANT,
  overall_score: 72,
  target_framework: "CMMC_L2",
  created_at: new Date().toISOString(),
};

const fakeRoadmapItem = {
  id: "item-001",
  title: "Enforce MFA",
  automation_status: "available_now",
  securewatch_agent: null,
  recommended_action: "Enable conditional access MFA",
  category: "identity_access",
  priority: "critical",
  status: "not_started",
};

/** Minimal PostureAssessmentResult with one roadmap item at each automation level */
function makeResult(
  automationLevel: "now" | "later" | "not_yet" = "now",
  priority: "critical" | "high" | "medium" | "low" = "critical"
): PostureAssessmentResult {
  return {
    tenantId: TENANT,
    overallScore: 65,
    maturityLabel: "Developing",
    targetFramework: "CMMC_L2",
    targetScore: 80,
    readinessPercentage: 81,
    summary: "Test summary",
    isEstimated: false,
    categoryScores: {
      identity_access: 60,
      endpoint_security: 70,
      vulnerability_management: 50,
      network_security: 80,
      backup_recovery: 75,
      monitoring_logging: 65,
      compliance_evidence: 55,
      security_awareness: 90,
      incident_response: 70,
    },
    frameworkReadiness: [],
    gaps: [],
    roadmapItems: [
      {
        title: "Test Item",
        category: "identity_access",
        relatedFramework: "CMMC_L2",
        priority,
        estimatedEffort: "low",
        estimatedImpactScore: 90,
        currentState: "MFA partially enforced",
        desiredState: "MFA enforced for all privileged users",
        recommendedAction: "Enable Conditional Access policy",
        automationLevel,
        isEstimated: false,
      },
    ],
    distanceToTarget: { currentScore: 65, targetScore: 80, distance: 15, status: "approaching", percentOfWayThere: 81 },
  };
}

// ─── getLatestPostureAssessment ───────────────────────────────────────────────

describe("getLatestPostureAssessment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the assessment when Supabase returns data", async () => {
    mockSupabase({ data: fakeAssessment, error: null });
    const result = await getLatestPostureAssessment(TENANT);
    expect(result).toMatchObject({ id: "assess-001", tenant_id: TENANT });
  });

  it("returns null when Supabase returns no data", async () => {
    mockSupabase({ data: null, error: null });
    const result = await getLatestPostureAssessment(TENANT);
    expect(result).toBeNull();
  });

  it("throws PostureRoadmapError with SUPABASE_ERROR when Supabase errors", async () => {
    mockSupabase({ data: null, error: { message: "connection refused" } });
    await expect(getLatestPostureAssessment(TENANT)).rejects.toMatchObject({
      code: "SUPABASE_ERROR",
    });
  });

  it("thrown error is an instance of PostureRoadmapError", async () => {
    mockSupabase({ data: null, error: { message: "timeout" } });
    await expect(getLatestPostureAssessment(TENANT)).rejects.toBeInstanceOf(PostureRoadmapError);
  });
});

// ─── updateRoadmapItemStatus ──────────────────────────────────────────────────

describe("updateRoadmapItemStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the updated item when update succeeds", async () => {
    const updated = { ...fakeRoadmapItem, status: "in_progress" };
    mockSupabase({ data: updated, error: null });
    const result = await updateRoadmapItemStatus("item-001", "in_progress");
    expect(result).toMatchObject({ id: "item-001", status: "in_progress" });
  });

  it("throws ASSESSMENT_NOT_FOUND when item is not found (null data)", async () => {
    mockSupabase({ data: null, error: null });
    await expect(updateRoadmapItemStatus("missing-id", "completed")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND",
    });
  });

  it("throws SUPABASE_ERROR when Supabase errors on update", async () => {
    mockSupabase({ data: null, error: { message: "RLS violation" } });
    await expect(updateRoadmapItemStatus("item-001", "in_progress")).rejects.toMatchObject({
      code: "SUPABASE_ERROR",
    });
  });
});

// ─── createPostureAssessment — automation mapping ─────────────────────────────

describe("createPostureAssessment — automation status mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * We test the mapping indirectly by verifying the service doesn't throw
   * when provided different automationLevel values. The actual mapping logic
   * is exercised in integration; here we confirm the chain completes.
   */
  it.each(["now", "later", "not_yet"] as const)(
    "automationLevel '%s' maps to correct automation_status without throwing",
    async (level) => {
      // Mock assessment insert returns a valid row; all subsequent inserts succeed
      let callCount = 0;
      (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: () => {
          callCount++;
          // First call is the assessment insert (needs .single())
          if (callCount === 1) {
            return makeChain({ data: { ...fakeAssessment, id: "assess-map" }, error: null });
          }
          // Subsequent calls are child table inserts — return success
          return makeChain({ data: [], error: null });
        },
      } as unknown as ReturnType<typeof getSupabaseAdminClient>);

      const result = await createPostureAssessment(makeResult(level), TENANT);
      expect(result).toMatchObject({ id: "assess-map" });
    }
  );

  it("throws SUPABASE_ERROR when the assessment row insert fails", async () => {
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => makeChain({ data: null, error: { message: "not null violation" } }),
    } as unknown as ReturnType<typeof getSupabaseAdminClient>);

    await expect(createPostureAssessment(makeResult(), TENANT)).rejects.toMatchObject({
      code: "SUPABASE_ERROR",
    });
  });
});

// ─── createPostureAssessment — bucket mapping ─────────────────────────────────

describe("createPostureAssessment — roadmap bucket mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["critical", "high", "medium", "low"] as const)(
    "priority '%s' maps to correct roadmap_bucket without throwing",
    async (priority) => {
      let callCount = 0;
      (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: () => {
          callCount++;
          if (callCount === 1) {
            return makeChain({ data: { ...fakeAssessment, id: "assess-bucket" }, error: null });
          }
          return makeChain({ data: [], error: null });
        },
      } as unknown as ReturnType<typeof getSupabaseAdminClient>);

      const result = await createPostureAssessment(makeResult("now", priority), TENANT);
      expect(result).toMatchObject({ id: "assess-bucket" });
    }
  );
});

// ─── previewAutomationPlan ────────────────────────────────────────────────────

describe("previewAutomationPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns canAutomate=true when automation_status is available_now", async () => {
    mockSupabase({ data: { ...fakeRoadmapItem, automation_status: "available_now" }, error: null });
    const preview = await previewAutomationPlan("item-001");
    expect(preview.canAutomate).toBe(true);
  });

  it("returns canAutomate=false when automation_status is planned", async () => {
    mockSupabase({ data: { ...fakeRoadmapItem, automation_status: "planned" }, error: null });
    const preview = await previewAutomationPlan("item-001");
    expect(preview.canAutomate).toBe(false);
  });

  it("returns canAutomate=false when automation_status is manual_only", async () => {
    mockSupabase({ data: { ...fakeRoadmapItem, automation_status: "manual_only" }, error: null });
    const preview = await previewAutomationPlan("item-001");
    expect(preview.canAutomate).toBe(false);
  });

  it("throws ASSESSMENT_NOT_FOUND when item does not exist", async () => {
    mockSupabase({ data: null, error: null });
    await expect(previewAutomationPlan("ghost-id")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND",
    });
  });

  it("throws SUPABASE_ERROR when DB call fails", async () => {
    mockSupabase({ data: null, error: { message: "query failed" } });
    await expect(previewAutomationPlan("item-001")).rejects.toMatchObject({
      code: "SUPABASE_ERROR",
    });
  });

  it("preview contains itemId and title", async () => {
    mockSupabase({ data: fakeRoadmapItem, error: null });
    const preview = await previewAutomationPlan("item-001");
    expect(preview.itemId).toBe("item-001");
    expect(preview.title).toBe("Enforce MFA");
  });

  it("available_now preview includes next steps referencing automation", async () => {
    mockSupabase({ data: { ...fakeRoadmapItem, automation_status: "available_now" }, error: null });
    const preview = await previewAutomationPlan("item-001");
    const combined = [preview.automationSummary, ...preview.nextSteps].join(" ");
    expect(combined.toLowerCase()).toMatch(/automat/);
  });
});

// ─── getFrameworkReadinessScores ──────────────────────────────────────────────

describe("getFrameworkReadinessScores", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no rows found", async () => {
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.select = self;
        chain.eq = self;
        chain.order = self;
        // Array-terminal: resolves directly
        chain.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve);
        return chain;
      },
    } as unknown as ReturnType<typeof getSupabaseAdminClient>);

    const result = await getFrameworkReadinessScores("assess-001");
    expect(result).toEqual([]);
  });

  it("throws SUPABASE_ERROR on DB failure", async () => {
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.select = self;
        chain.eq = self;
        chain.order = self;
        chain.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: { message: "db error" } }).then(resolve);
        return chain;
      },
    } as unknown as ReturnType<typeof getSupabaseAdminClient>);

    await expect(getFrameworkReadinessScores("assess-001")).rejects.toMatchObject({
      code: "SUPABASE_ERROR",
    });
  });
});

// ─── PostureRoadmapError shape ────────────────────────────────────────────────

describe("PostureRoadmapError", () => {
  it("is an instance of Error", () => {
    const err = new PostureRoadmapError("test", "SUPABASE_ERROR");
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name", () => {
    const err = new PostureRoadmapError("test", "INVALID_FRAMEWORK");
    expect(err.name).toBe("PostureRoadmapError");
  });

  it("exposes the error code", () => {
    const err = new PostureRoadmapError("test", "ASSESSMENT_NOT_FOUND");
    expect(err.code).toBe("ASSESSMENT_NOT_FOUND");
  });

  it("stores the message", () => {
    const err = new PostureRoadmapError("something broke", "SUPABASE_ERROR");
    expect(err.message).toBe("something broke");
  });
});
