import { z } from "zod";
import { assertRecommendationNeverExecutes } from "./aiDecision.schema";

export type ValidatedAiOutput<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; zod_error?: string };

/**
 * Validates model JSON against a Zod schema — all governed AI paths must pass through this.
 */
export function validateAiOutput<T>(raw: unknown, schema: z.ZodType<T>): ValidatedAiOutput<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "schema_validation_failed", zod_error: parsed.error.message };
  }
  return { ok: true, data: parsed.data };
}

const FORBIDDEN_EXECUTION_PHRASES = [
  /\bI\s+have\s+executed\b/i,
  /\bremediation\s+has\s+been\s+applied\b/i,
  /\bI\s+ran\s+the\s+remediation\b/i,
  /\baction\s+was\s+executed\s+live\b/i,
  /\bbypass(ed)?\s+approval\b/i,
];

/**
 * Lightweight heuristics to flag text that implies side effects or approval bypass (not a substitute for policy).
 */
export function runHallucinationGuardrails(text: string): { ok: boolean; flags: string[] } {
  const flags: string[] = [];
  for (const re of FORBIDDEN_EXECUTION_PHRASES) {
    if (re.test(text)) {
      flags.push(`forbidden_phrase:${re.source}`);
    }
  }
  if (text.length > 0 && !/\b(finding|incident|policy|control|CVE|ticket)\b/i.test(text) && text.length > 400) {
    flags.push("low_entity_anchor_density");
  }
  return { ok: flags.length === 0, flags };
}

/**
 * Ensures structured action recommendations never carry execution directives.
 */
export function assertNoAiExecutionDirective(payload: unknown): void {
  assertRecommendationNeverExecutes(payload);
  if (typeof payload === "object" && payload !== null) {
    const o = payload as Record<string, unknown>;
    if (o.execution_plane === "recommendation_only" && o.execute_immediately === true) {
      throw new Error("ai_governance:execution_plane_conflict");
    }
    if (typeof o.rationale === "string") {
      const h = runHallucinationGuardrails(o.rationale);
      if (!h.ok) {
        throw new Error(`ai_governance:hallucination_flags:${h.flags.join(",")}`);
      }
    }
  }
}
