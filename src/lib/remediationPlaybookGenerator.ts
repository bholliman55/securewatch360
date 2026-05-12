import Anthropic from "@anthropic-ai/sdk";

export interface PlaybookInput {
  title: string;
  severity: string;
  description: string;
  assetType?: string;
  frameworkControls?: string[];
}

export interface RemediationPlaybook {
  steps: string[];
  estimatedEffort: "< 1 hour" | "1-4 hours" | "1 day" | "1 week+";
  requiredRole: string;
  automatable: boolean;
  generatedAt: string;
}

// Module-level cache: findingId → playbook
const _cache = new Map<string, RemediationPlaybook>();

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a senior security engineer. Generate a precise, actionable remediation playbook.
Respond ONLY with valid JSON — no markdown, no explanation — matching this exact shape:
{
  "steps": ["step 1", "step 2", ...],
  "estimatedEffort": "< 1 hour" | "1-4 hours" | "1 day" | "1 week+",
  "requiredRole": "string describing required role/team",
  "automatable": true | false
}
Maximum 8 steps. Steps should be concrete commands or actions, not vague advice.`;

async function callClaude(input: PlaybookInput): Promise<RemediationPlaybook> {
  const client = getClient();
  const prompt = `Generate a remediation playbook for this security finding:

Title: ${input.title}
Severity: ${input.severity}
Asset Type: ${input.assetType ?? "unknown"}
Framework Controls: ${input.frameworkControls?.join(", ") ?? "none"}
Description: ${input.description}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const extraInstruction = attempt === 1
      ? "\n\nIMPORTANT: Your previous response was not valid JSON. Respond with ONLY the JSON object, nothing else."
      : "";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt + extraInstruction }],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    try {
      const parsed = JSON.parse(raw) as Omit<RemediationPlaybook, "generatedAt">;
      if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) continue;
      return { ...parsed, generatedAt: new Date().toISOString() };
    } catch {
      if (attempt === 1) throw new Error(`Playbook generation returned invalid JSON after retry`);
    }
  }
  throw new Error("Playbook generation failed");
}

export async function generatePlaybook(
  input: PlaybookInput,
  cacheKey?: string
): Promise<RemediationPlaybook> {
  if (cacheKey && _cache.has(cacheKey)) {
    return _cache.get(cacheKey)!;
  }
  const playbook = await callClaude(input);
  if (cacheKey) _cache.set(cacheKey, playbook);
  return playbook;
}
