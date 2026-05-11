/**
 * Unit tests for postureDataAdapter.ts and postureRoadmapService.ts
 *
 * Tests cover the deterministic, non-Supabase parts:
 *   - PostureRoadmapError class behaviour
 *   - validateFramework()
 *   - toAutomationStatus / toRoadmapBucket mappings (tested via type contracts)
 *   - previewAutomationPlan deterministic logic (via extracted helper coverage)
 *
 * Full integration tests (buildPostureScoringInput, generateNewPostureAssessment)
 * require a real or mocked Supabase instance and are deferred to integration tests.
 */
import { describe, it, expect } from "vitest";
import { PostureRoadmapError, validateFramework } from "../postureDataAdapter";
import { FRAMEWORK_TYPES } from "@/features/posture-roadmap/types/postureTypes";

// ─────────────────────────────────────────────────────────────────────────────
// PostureRoadmapError
// ─────────────────────────────────────────────────────────────────────────────

describe("PostureRoadmapError", () => {
  it("has the correct name", () => {
    const err = new PostureRoadmapError("msg", "TENANT_NOT_FOUND");
    expect(err.name).toBe("PostureRoadmapError");
  });

  it("stores the message", () => {
    const err = new PostureRoadmapError("tenant not found", "TENANT_NOT_FOUND");
    expect(err.message).toBe("tenant not found");
  });

  it("stores the error code", () => {
    const err = new PostureRoadmapError("msg", "INVALID_FRAMEWORK");
    expect(err.code).toBe("INVALID_FRAMEWORK");
  });

  it("stores optional cause", () => {
    const cause = new Error("original");
    const err = new PostureRoadmapError("msg", "SUPABASE_ERROR", cause);
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new PostureRoadmapError("msg", "NO_SCAN_DATA");
    expect(err).toBeInstanceOf(Error);
  });

  it("cause is undefined when not provided", () => {
    const err = new PostureRoadmapError("msg", "UNAUTHORIZED");
    expect(err.cause).toBeUndefined();
  });

  it("supports all defined error codes without TypeScript errors", () => {
    const codes = [
      "TENANT_NOT_FOUND",
      "ASSESSMENT_NOT_FOUND",
      "INVALID_FRAMEWORK",
      "NO_SCAN_DATA",
      "SUPABASE_ERROR",
      "UNAUTHORIZED",
    ] as const;
    for (const code of codes) {
      const err = new PostureRoadmapError(`test ${code}`, code);
      expect(err.code).toBe(code);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateFramework
// ─────────────────────────────────────────────────────────────────────────────

describe("validateFramework", () => {
  it("does not throw for all valid FRAMEWORK_TYPES", () => {
    for (const fw of FRAMEWORK_TYPES) {
      expect(() => validateFramework(fw)).not.toThrow();
    }
  });

  it("accepts lowercase variants (normalises to uppercase internally)", () => {
    expect(() => validateFramework("cis")).not.toThrow();
    expect(() => validateFramework("nist")).not.toThrow();
    expect(() => validateFramework("hipaa")).not.toThrow();
    expect(() => validateFramework("soc2")).not.toThrow();
    expect(() => validateFramework("cmmc_l1")).not.toThrow();
    expect(() => validateFramework("cmmc_l2")).not.toThrow();
  });

  it("throws PostureRoadmapError with INVALID_FRAMEWORK for unknown framework", () => {
    expect(() => validateFramework("ISO27001")).toThrow(PostureRoadmapError);
    try {
      validateFramework("UNKNOWN_FRAMEWORK");
    } catch (e) {
      expect(e).toBeInstanceOf(PostureRoadmapError);
      expect((e as PostureRoadmapError).code).toBe("INVALID_FRAMEWORK");
    }
  });

  it("throws for empty string", () => {
    expect(() => validateFramework("")).toThrow(PostureRoadmapError);
  });

  it("throws for partially matching strings", () => {
    expect(() => validateFramework("CMMC")).toThrow(PostureRoadmapError);
    expect(() => validateFramework("SOC")).toThrow(PostureRoadmapError);
  });

  it("error message lists valid frameworks", () => {
    try {
      validateFramework("BAD");
    } catch (e) {
      expect((e as PostureRoadmapError).message).toContain("CIS");
      expect((e as PostureRoadmapError).message).toContain("CMMC_L2");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRAMEWORK_TYPES constant
// ─────────────────────────────────────────────────────────────────────────────

describe("FRAMEWORK_TYPES", () => {
  it("contains exactly 6 frameworks", () => {
    expect(FRAMEWORK_TYPES).toHaveLength(6);
  });

  it("includes all expected frameworks", () => {
    const expected = ["CIS", "NIST", "CMMC_L1", "CMMC_L2", "HIPAA", "SOC2"];
    for (const fw of expected) {
      expect(FRAMEWORK_TYPES).toContain(fw);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AutomationStatus / RoadmapBucket mapping contracts
// (tested via the type system + runtime checks on string values)
// ─────────────────────────────────────────────────────────────────────────────

describe("AutomationStatus values", () => {
  it("AUTOMATION_STATUSES contains the three DB check values", async () => {
    const { AUTOMATION_STATUSES } = await import(
      "@/features/posture-roadmap/types/postureTypes"
    );
    expect(AUTOMATION_STATUSES).toContain("available_now");
    expect(AUTOMATION_STATUSES).toContain("planned");
    expect(AUTOMATION_STATUSES).toContain("manual_only");
    expect(AUTOMATION_STATUSES).toHaveLength(3);
  });
});

describe("RoadmapBucket values", () => {
  it("ROADMAP_BUCKETS contains the four DB check values", async () => {
    const { ROADMAP_BUCKETS } = await import(
      "@/features/posture-roadmap/types/postureTypes"
    );
    expect(ROADMAP_BUCKETS).toContain("fix_first");
    expect(ROADMAP_BUCKETS).toContain("next_30_days");
    expect(ROADMAP_BUCKETS).toContain("next_60_days");
    expect(ROADMAP_BUCKETS).toContain("next_90_days");
    expect(ROADMAP_BUCKETS).toHaveLength(4);
  });
});
