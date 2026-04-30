import Anthropic from "@anthropic-ai/sdk";
import { ParsedCommandSchema, SUPPORTED_INTENTS, SUPPORTED_AGENTS } from "./intentSchema";
import type { ParsedCommand } from "./intentSchema";
import type { LLMParser } from "./nlTypes";

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
  "requiresApproval": <boolean>,
  "reason": "<short reason>"
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

class ClaudeParser implements LLMParser {
  name = "claude";

  async parse(input: string): Promise<ParsedCommand> {
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
}

class DeterministicFallbackParser implements LLMParser {
  name = "deterministic_fallback";

  private extractDomain(raw: string): string | null {
    const urlMatch = raw.match(/https?:\/\/[^\s/$.?#].[^\s]*/i);
    if (urlMatch?.[0]) {
      try {
        return new URL(urlMatch[0]).hostname.toLowerCase();
      } catch {
        // ignore and continue with other extraction paths
      }
    }

    const bareMatch = raw.match(/\b([a-z0-9.-]+\.[a-z]{2,})\b/i);
    if (bareMatch?.[1]) {
      return bareMatch[1].toLowerCase();
    }
    return null;
  }

  async parse(input: string): Promise<ParsedCommand> {
    const normalized = input.trim().toLowerCase();
    const parameters: Record<string, unknown> = {};
    const extractedDomain = this.extractDomain(input);
    if (extractedDomain) {
      parameters.domain = extractedDomain;
    }

    let intent: ParsedCommand["intent"] = "get_status";
    let agent: ParsedCommand["agent"] = "agent2";
    let confidence = 0.52;
    let requiresApproval = false;
    let reason = "Fallback matched a status-oriented command pattern.";

    if (/external intelligence|osint|threat intel|attack surface/.test(normalized)) {
      intent = "get_external_intelligence";
      agent = "multi_agent";
      confidence = 0.76;
      reason = "Fallback matched external intelligence keywords.";
    } else if (/remediat|patch|fix finding|trigger fix/.test(normalized)) {
      intent = "trigger_remediation";
      agent = "agent2";
      confidence = 0.74;
      requiresApproval = true;
      reason = "Fallback detected remediation action, which is high risk.";
    } else if (/compliance|nist|hipaa|pci|soc 2|iso/.test(normalized)) {
      intent = "get_compliance";
      agent = "agent3";
      confidence = 0.74;
      reason = "Fallback matched compliance and framework keywords.";
    } else if (/risk|high risk|critical risk|risk register/.test(normalized)) {
      intent = "get_risks";
      agent = "agent4";
      confidence = 0.74;
      reason = "Fallback matched risk and severity-related keywords.";
    } else if (/alert summary|summarize alerts|summarize incidents|summarize/.test(normalized)) {
      intent = "summarize_alerts";
      agent = "agent5";
      confidence = 0.71;
      reason = "Fallback matched alert summary keywords.";
    } else if (/run scan|start scan|scan now|start assessment/.test(normalized)) {
      intent = "run_scan";
      agent = "agent2";
      confidence = 0.78;
      reason = "Fallback matched scan execution keywords.";
    }

    const result = ParsedCommandSchema.safeParse({
      intent,
      agent,
      confidence,
      parameters,
      requiresApproval,
      reason,
    });
    if (!result.success) {
      throw new Error(`Fallback parser produced invalid command: ${result.error.message}`);
    }
    return result.data;
  }
}

export async function parseCommand(input: string): Promise<ParsedCommand> {
  const fallbackParser = new DeterministicFallbackParser();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackParser.parse(input);
  }

  const providers: LLMParser[] = [new ClaudeParser(), fallbackParser];

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      return await provider.parse(input);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new Error(lastError?.message ?? "Unable to parse command");
}
