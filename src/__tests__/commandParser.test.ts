import { beforeEach, describe, expect, it } from "vitest";
import { parseCommand } from "@/nl/commandParser";

describe("parseCommand fallback parser", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "";
  });

  it("parses external intelligence as multi_agent", async () => {
    const parsed = await parseCommand("Run external intelligence for https://example.com");
    expect(parsed.intent).toBe("get_external_intelligence");
    expect(parsed.agent).toBe("multi_agent");
    expect(parsed.parameters).toHaveProperty("domain", "example.com");
    expect(parsed.reason.length).toBeGreaterThan(0);
  });

  it("forces approval for remediation commands", async () => {
    const parsed = await parseCommand("Trigger remediation for finding abc-123");
    expect(parsed.intent).toBe("trigger_remediation");
    expect(parsed.requiresApproval).toBe(true);
  });

  it("maps compliance queries to agent3", async () => {
    const parsed = await parseCommand("Show HIPAA compliance status");
    expect(parsed.intent).toBe("get_compliance");
    expect(parsed.agent).toBe("agent3");
    expect(parsed.requiresApproval).toBe(false);
  });
});
