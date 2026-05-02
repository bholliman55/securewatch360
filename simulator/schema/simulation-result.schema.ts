/**
 * Runtime schema for simulation run outcomes (aggregated lab / CI report rows).
 */

import { z } from "zod";

export const validationResultRowSchema = z
  .object({
    expectation_id: z.string().min(1),
    passed: z.boolean(),
    detail: z.string(),
    observed: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ValidationResultRow = z.infer<typeof validationResultRowSchema>;

export const simulationResultSchema = z
  .object({
    run_id: z.string().min(1),
    scenario_id: z.string().min(1),
    passed: z.boolean(),
    validations: z.array(validationResultRowSchema),
    summary: z.string().min(1),
    /** ISO-8601 timestamp string */
    finished_at: z.string().min(1),
  })
  .strict();

export type SimulationResultDocument = z.infer<typeof simulationResultSchema>;

export function parseSimulationResult(data: unknown): SimulationResultDocument {
  return simulationResultSchema.parse(data);
}

export function safeParseSimulationResult(data: unknown) {
  return simulationResultSchema.safeParse(data);
}
