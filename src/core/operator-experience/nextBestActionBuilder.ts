import { randomUUID } from "node:crypto";
import type { ExecutiveBrief } from "./executiveBrief.schema";
import { executiveBriefSchema } from "./executiveBrief.schema";

export type NextBestActionInput = {
  tenant_id: string;
  simulation_run_id: string;
  scenario_title: string;
  scenario_goal: string;
  outcomes_plain_english: string[];
  risks_if_ignored: string[];
  recommended_follow_ups: string[];
};

/**
 * Produces an executive-readable simulation summary — suitable for demos and leadership readouts.
 */
export function buildExecutiveSimulationBrief(input: NextBestActionInput): ExecutiveBrief {
  const notable = [...input.outcomes_plain_english, ...input.recommended_follow_ups].slice(0, 12);
  const questions = input.risks_if_ignored.slice(0, 8);

  const exec =
    `Simulation: ${input.scenario_title}. ${input.scenario_goal} ` +
    `Key simulated outcomes: ${input.outcomes_plain_english.slice(0, 5).join(" ") || "See notable actions below."}`;

  return executiveBriefSchema.parse({
    brief_id: randomUUID(),
    tenant_id: input.tenant_id,
    simulation_run_id: input.simulation_run_id,
    generated_at: new Date().toISOString(),
    executive_summary: exec.slice(0, 6000),
    business_impact:
      input.risks_if_ignored.length > 0
        ? `If these issues were left unaddressed in production: ${input.risks_if_ignored.join(" ")}`.slice(0, 4000)
        : "Business impact is illustrative in simulation mode — translate lessons to your production risk register.",
    posture_delta:
      input.outcomes_plain_english.length > 0
        ? `Observed posture shifts in the exercise: ${input.outcomes_plain_english.join(" ")}`.slice(0, 4000)
        : "Posture changes are narrative-only in this rehearsal unless wired to live telemetry.",
    notable_actions: notable.map((s) => s.slice(0, 500)),
    open_questions: questions.map((s) => s.slice(0, 500)),
  });
}
