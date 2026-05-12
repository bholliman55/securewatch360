/**
 * `POST /api/demo/voice-command` service handler.
 *
 * Simulates the ElevenLabs voice gateway *locally*. Takes a free-text
 * command, classifies it deterministically into one of the four
 * supported intents (or `unknown`), and returns a calm executive-friendly
 * spoken summary plus an action result describing what the (simulated)
 * gateway did about it.
 *
 * No external services are called — no ElevenLabs, no LLM, no remediation
 * APIs. The classifier is a tiny rule-based matcher; the action layer
 * either narrates state or generates an executive report row in
 * `demo_reports` (the same path the `/report` endpoint uses).
 *
 * The four canonical example utterances:
 *   - "Summarize the threat"
 *   - "Why did you recommend isolation?"
 *   - "Generate the executive report"
 *   - "What is the compliance impact?"
 */

import {
  INVESTOR_DEMO_SCENARIO,
  type DemoActionRow,
  type DemoAgentReasoningRow,
  type DemoEventRow,
} from "@/demo/investorMode";
import { getSupabaseAdminClient } from "@/lib/supabase";

import { handleReport } from "./report";
import type {
  DemoServiceDeps,
  VoiceActionResult,
  VoiceCommandInput,
  VoiceCommandResult,
  VoiceIntent,
} from "./types";

// ---------------------------------------------------------------------------
// Intent classifier
// ---------------------------------------------------------------------------

interface IntentRule {
  intent: VoiceIntent;
  example: string;
  /** Each pattern is matched after the input is lowercased and trimmed. */
  patterns: ReadonlyArray<RegExp>;
}

const INTENT_RULES: ReadonlyArray<IntentRule> = [
  {
    intent: "summarize_threat",
    example: "Summarize the threat",
    patterns: [
      /\bsummari[sz]e\b.*\bthreat\b/i,
      /\bwhat\b.*\bhappened\b/i,
      /\brecap\b/i,
      /\bbrief(?:ing)?\b/i,
    ],
  },
  {
    intent: "explain_isolation",
    example: "Why did you recommend isolation?",
    // NOTE: trailing word boundary intentionally omitted on the verb stems
    // so we match `isolation`, `containment`, `quarantined`, etc.
    patterns: [
      /\bwhy\b.*\b(isolat|contain|quarantin)/i,
      /\b(reason|because|justif)\b.*\b(isolat|contain|quarantin)/i,
      /\bjustify\b.*\b(isolat|contain|quarantin)/i,
    ],
  },
  {
    intent: "generate_report",
    example: "Generate the executive report",
    patterns: [
      /\b(generate|create|produce|make)\b.*\b(executive |exec |leadership |incident )?report\b/i,
      /\breport\b.*\b(now|please|generate)/i,
    ],
  },
  {
    intent: "describe_compliance",
    example: "What is the compliance impact?",
    patterns: [
      /\bcompliance\b/i,
      /\b(hipaa|cmmc|nist|soc\s*2|pci|gdpr)\b/i,
      /\bregulator/i,
    ],
  },
];

export function classifyVoiceCommand(commandText: string): {
  intent: VoiceIntent;
  matchedExample: string | null;
} {
  const trimmed = commandText.trim();
  if (trimmed.length === 0) {
    return { intent: "unknown", matchedExample: null };
  }
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(trimmed))) {
      return { intent: rule.intent, matchedExample: rule.example };
    }
  }
  return { intent: "unknown", matchedExample: null };
}

// ---------------------------------------------------------------------------
// Spoken summaries — short, calm, executive-friendly. No marketing language.
// ---------------------------------------------------------------------------

function spokenForUnknown(commandText: string): string {
  const sample = commandText.trim().slice(0, 60);
  return `I did not recognise that command${sample ? ` — "${sample}"` : ""}. Try one of the suggested phrases.`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleVoiceCommand(
  input: VoiceCommandInput,
  deps: DemoServiceDeps = {},
): Promise<VoiceCommandResult> {
  const errors: string[] = [];
  const commandText = (input?.commandText ?? "").trim();

  if (commandText.length === 0) {
    errors.push("commandText is required");
    return {
      ok: false,
      commandText: "",
      intent: "unknown",
      matchedExample: null,
      spokenSummary:
        "I did not receive a command. Please say one of the suggested phrases.",
      action: null,
      errors,
    };
  }

  const { intent, matchedExample } = classifyVoiceCommand(commandText);

  switch (intent) {
    case "summarize_threat":
      return await summarizeThreat(commandText, matchedExample, deps);
    case "explain_isolation":
      return await explainIsolation(commandText, matchedExample, deps);
    case "generate_report":
      return await generateReportIntent(commandText, matchedExample, deps);
    case "describe_compliance":
      return await describeCompliance(commandText, matchedExample, deps);
    case "unknown":
    default:
      return {
        ok: true,
        commandText,
        intent: "unknown",
        matchedExample: null,
        spokenSummary: spokenForUnknown(commandText),
        action: { type: "no_op", summary: "No matching intent.", payload: {} },
        errors,
      };
  }
}

// ---------------------------------------------------------------------------
// Intent handlers
// ---------------------------------------------------------------------------

async function summarizeThreat(
  commandText: string,
  matchedExample: string | null,
  deps: DemoServiceDeps,
): Promise<VoiceCommandResult> {
  const supabase = deps.supabase ?? getSupabaseAdminClient();
  const errors: string[] = [];

  const events = await fetchEmittedEvents(supabase, errors);
  const recent = events.slice(-3);

  let spokenSummary: string;
  if (recent.length === 0) {
    spokenSummary =
      `No simulated events have fired yet for ${INVESTOR_DEMO_SCENARIO.client.client_name}. Start the simulation to begin the briefing.`;
  } else {
    const lastTitles = recent.map((e) => e.title).join(", ");
    spokenSummary =
      `Latest activity for ${INVESTOR_DEMO_SCENARIO.client.client_name}: ${lastTitles}. ` +
      `${recent.length === 3 ? "The pattern is consistent with ransomware-precursor behaviour in this controlled simulation." : "Monitoring continues."}`;
  }

  return {
    ok: errors.length === 0,
    commandText,
    intent: "summarize_threat",
    matchedExample,
    spokenSummary,
    action: {
      type: "narrate",
      summary: "Returned a verbal summary of the most recent emitted events.",
      payload: { recent_event_count: recent.length },
    },
    errors,
  };
}

async function explainIsolation(
  commandText: string,
  matchedExample: string | null,
  deps: DemoServiceDeps,
): Promise<VoiceCommandResult> {
  const supabase = deps.supabase ?? getSupabaseAdminClient();
  const errors: string[] = [];

  // Agent 5's classification reasoning is the underlying justification for
  // the containment recommendation in the canonical scenario seed.
  const reasoning = await fetchReasoning(
    supabase,
    "agent_classification",
    errors,
  );
  const action = await fetchAction(supabase, "isolate_endpoint", errors);

  let spokenSummary: string;
  if (reasoning) {
    spokenSummary =
      `I recommended isolation because ${reasoning.reasoning_summary} ` +
      `Containment limits blast radius before the file server is reached, in this controlled simulation.`;
  } else {
    spokenSummary =
      "Isolation has not yet been recommended in this run. The recommendation appears once Agent five classifies the chain as a ransomware precursor.";
  }

  return {
    ok: errors.length === 0,
    commandText,
    intent: "explain_isolation",
    matchedExample,
    spokenSummary,
    action: {
      type: "explain_isolation",
      summary: "Surfaced the agent reasoning behind the containment recommendation.",
      payload: {
        reasoning_event_type: "agent_classification",
        action_status: action?.status ?? null,
        action_confirmed: action?.confirmed ?? null,
      },
    },
    errors,
  };
}

async function generateReportIntent(
  commandText: string,
  matchedExample: string | null,
  deps: DemoServiceDeps,
): Promise<VoiceCommandResult> {
  // Reuse the same path as `POST /api/demo/report` so reports stay consistent
  // regardless of whether they were triggered by a button click or a voice
  // command — single source of truth.
  const result = await handleReport(deps);
  const ok = result.ok && result.report !== null;

  const spokenSummary = ok
    ? "Executive report generated. It is ready in the executive summary panel and the demo reports table."
    : "I could not generate the executive report. Please try again after seeding or running the simulation.";

  return {
    ok,
    commandText,
    intent: "generate_report",
    matchedExample,
    spokenSummary,
    action: {
      type: "generate_report",
      summary: ok
        ? "Inserted a new executive report row in demo_reports."
        : "Report generation failed.",
      payload: {
        report_id: result.report?.id ?? null,
        report_title: result.report?.title ?? null,
      },
    },
    errors: result.errors,
  };
}

async function describeCompliance(
  commandText: string,
  matchedExample: string | null,
  deps: DemoServiceDeps,
): Promise<VoiceCommandResult> {
  const supabase = deps.supabase ?? getSupabaseAdminClient();
  const errors: string[] = [];

  // Agent 3's compliance-check reasoning row carries the HIPAA / CMMC impact
  // narrative in the canonical seed.
  const reasoning = await fetchReasoning(
    supabase,
    "agent_compliance_check",
    errors,
  );
  const frameworks = INVESTOR_DEMO_SCENARIO.client.compliance_frameworks;

  const spokenSummary = reasoning
    ? `Compliance impact: ${reasoning.reasoning_summary} Frameworks in scope: ${frameworks.join(", ")}.`
    : `Frameworks in scope for ${INVESTOR_DEMO_SCENARIO.client.client_name}: ${frameworks.join(", ")}. Agent three has not yet assessed impact in this run.`;

  return {
    ok: errors.length === 0,
    commandText,
    intent: "describe_compliance",
    matchedExample,
    spokenSummary,
    action: {
      type: "describe_compliance",
      summary: "Returned the compliance impact assessment for the scenario.",
      payload: {
        frameworks: [...frameworks],
        has_reasoning: reasoning !== null,
      },
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Tiny Supabase helpers (no joins, no unsafe casts beyond the row shape)
// ---------------------------------------------------------------------------

async function fetchEmittedEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  errors: string[],
): Promise<DemoEventRow[]> {
  try {
    const res = await supabase
      .from("demo_events")
      .select("*")
      .eq("scenario_key", INVESTOR_DEMO_SCENARIO.scenario_key)
      .eq("status", "emitted")
      .order("event_order", { ascending: true });
    if (res.error) {
      errors.push(`demo_events: ${res.error.message}`);
      return [];
    }
    return (res.data as DemoEventRow[] | null) ?? [];
  } catch (err) {
    errors.push(`demo_events: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function fetchReasoning(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  eventType: string,
  errors: string[],
): Promise<DemoAgentReasoningRow | null> {
  try {
    const res = await supabase
      .from("demo_agent_reasoning")
      .select("*")
      .eq("scenario_key", INVESTOR_DEMO_SCENARIO.scenario_key)
      .eq("event_type", eventType)
      .maybeSingle();
    if (res.error) {
      errors.push(`demo_agent_reasoning: ${res.error.message}`);
      return null;
    }
    return (res.data as DemoAgentReasoningRow | null) ?? null;
  } catch (err) {
    errors.push(
      `demo_agent_reasoning: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function fetchAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  actionType: string,
  errors: string[],
): Promise<DemoActionRow | null> {
  try {
    const res = await supabase
      .from("demo_actions")
      .select("*")
      .eq("scenario_key", INVESTOR_DEMO_SCENARIO.scenario_key)
      .eq("action_type", actionType)
      .maybeSingle();
    if (res.error) {
      errors.push(`demo_actions: ${res.error.message}`);
      return null;
    }
    return (res.data as DemoActionRow | null) ?? null;
  } catch (err) {
    errors.push(
      `demo_actions: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Defensive export so callers can suppress unused-import warnings.
// ---------------------------------------------------------------------------

export type { VoiceActionResult };
