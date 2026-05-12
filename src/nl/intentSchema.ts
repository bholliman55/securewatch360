import { z } from "zod";

export const SUPPORTED_INTENTS = [
  "run_scan",
  "get_status",
  "get_compliance",
  "get_risks",
  "summarize_alerts",
  "trigger_remediation",
  "get_external_intelligence",
] as const;

export type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];

export const SUPPORTED_AGENTS = ["agent1", "agent2", "agent3", "agent4", "agent5", "multi_agent"] as const;
export type SupportedAgent = (typeof SUPPORTED_AGENTS)[number];

export const ParsedCommandSchema = z.object({
  intent: z.enum(SUPPORTED_INTENTS),
  agent: z.enum(SUPPORTED_AGENTS),
  confidence: z.number().min(0).max(1),
  parameters: z.record(z.string(), z.unknown()),
  requiresApproval: z.boolean(),
  reason: z.string().min(1),
});

export type ParsedCommand = z.infer<typeof ParsedCommandSchema>;

// Per-intent parameter schemas for tighter validation downstream
export const IntentParameterSchemas: Record<SupportedIntent, z.ZodTypeAny> = {
  run_scan: z.object({
    domain: z.string().optional(),
    scanTargetId: z.string().optional(),
    clientId: z.string().optional(),
    scanType: z.enum(["full", "quick", "external"]).optional(),
  }),
  get_status: z.object({
    scanId: z.string().optional(),
    clientId: z.string().optional(),
  }),
  get_compliance: z.object({
    framework: z.string().optional(),
    clientId: z.string().optional(),
  }),
  get_risks: z.object({
    severity: z.enum(["critical", "high", "medium", "low"]).optional(),
    clientId: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }),
  summarize_alerts: z.object({
    since: z.string().optional(),
    clientId: z.string().optional(),
  }),
  trigger_remediation: z.object({
    findingId: z.string(),
    remediationType: z.string().optional(),
    clientId: z.string().optional(),
  }),
  get_external_intelligence: z.object({
    domain: z.string(),
    companyName: z.string().optional(),
    knownEmails: z.array(z.string()).optional(),
    clientId: z.string().optional(),
    runAgent1: z.boolean().optional(),
    runAgent2: z.boolean().optional(),
  }),
};
