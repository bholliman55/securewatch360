import Anthropic from "@anthropic-ai/sdk";
import { ParsedCommandSchema, SUPPORTED_INTENTS, SUPPORTED_AGENTS } from "./intentSchema";
import type { ParsedCommand } from "./intentSchema";

const SYSTEM_PROMPT = `You are a security operations command parser for SecureWatch360.
Convert the user's natural language input into a structured JSON command.

Supported intents: ${SUPPORTED_INTENTS.join(", ")}
Supported agents: ${SUPPORTED_AGENTS.join(", ")}

Agent assignments:
- agent1: external attack surface discovery (domains, subdomains, certificates)
- agent2: OSINT & threat intelligence, vulnerability scanning, general scans
- agent3: compliance status and framework checks (NIST, HIPAA, PCI-DSS, SOC 2, etc.)
- agent4: risk evaluation and risk register queries
- agent5: alert summarization and incident management

Intent routing:
- run_scan → agent2
- get_status → agent2
- get_compliance → agent3
- get_risks → agent4
- summarize_alerts → agent5
- trigger_remediation → agent2 (requires approval)
- get_external_intelligence → agent1 (always requires both agent1 + agent2; use agent1 as primary)

requiresApproval must be true for: trigger_remediation.
For all other intents, requiresApproval is false.

Extract any relevant parameters from the input (domain, clientId, framework, severity, etc.).
confidence is your estimate from 0.0 to 1.0 of how clearly the input maps to the intent.

Respond ONLY with valid JSON matching this exact shape, no markdown, no explanation:
{
  "intent": "<intent>",
  "agent": "<agent>",
  "confidence": <number>,
  "parameters": { ... },
  "requiresApproval": <boolean>
}`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function parseCommand(input: string): Promise<ParsedCommand> {
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: input }],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    throw new Error(`Command parser returned invalid JSON: ${rawText.slice(0, 200)}`);
  }

  const result = ParsedCommandSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Parsed command failed schema validation: ${result.error.message}`);
  }

  return result.data;
}
