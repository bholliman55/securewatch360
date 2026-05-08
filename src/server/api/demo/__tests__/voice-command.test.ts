import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyVoiceCommand, handleVoiceCommand } from "../voice-command";
import { handleSeed } from "../seed";
import { makeMemorySupabase } from "@/demo/investorMode/__tests__/_memorySupabase";
import { INVESTOR_DEMO_SCENARIO } from "@/demo/investorMode";

describe("classifyVoiceCommand", () => {
  it("matches 'Summarize the threat' to summarize_threat", () => {
    expect(classifyVoiceCommand("Summarize the threat").intent).toBe(
      "summarize_threat",
    );
    expect(classifyVoiceCommand("SecureWatch, summarise the threat").intent).toBe(
      "summarize_threat",
    );
    expect(classifyVoiceCommand("What happened tonight?").intent).toBe(
      "summarize_threat",
    );
  });

  it("matches 'Why did you recommend isolation?' to explain_isolation", () => {
    expect(
      classifyVoiceCommand("Why did you recommend isolation?").intent,
    ).toBe("explain_isolation");
    expect(
      classifyVoiceCommand("Justify the containment").intent,
    ).toBe("explain_isolation");
  });

  it("matches 'Generate the executive report' to generate_report", () => {
    expect(
      classifyVoiceCommand("Generate the executive report").intent,
    ).toBe("generate_report");
    expect(classifyVoiceCommand("Create the leadership report").intent).toBe(
      "generate_report",
    );
    expect(classifyVoiceCommand("Produce an incident report").intent).toBe(
      "generate_report",
    );
  });

  it("matches 'What is the compliance impact?' to describe_compliance", () => {
    expect(
      classifyVoiceCommand("What is the compliance impact?").intent,
    ).toBe("describe_compliance");
    expect(classifyVoiceCommand("Explain the HIPAA exposure").intent).toBe(
      "describe_compliance",
    );
    expect(classifyVoiceCommand("How does this affect CMMC?").intent).toBe(
      "describe_compliance",
    );
  });

  it("returns unknown for empty or unrelated input", () => {
    expect(classifyVoiceCommand("").intent).toBe("unknown");
    expect(classifyVoiceCommand("    ").intent).toBe("unknown");
    expect(classifyVoiceCommand("What's the weather like").intent).toBe(
      "unknown",
    );
  });
});

describe("handleVoiceCommand", () => {
  // Spy on global fetch for the duration of these tests so we can prove the
  // handler never reaches out to a real external service.
  let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("voice-command must not call real fetch");
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = null;
  });

  it("rejects an empty command with ok=false", async () => {
    const { client } = makeMemorySupabase();

    const result = await handleVoiceCommand(
      { commandText: "" },
      { supabase: client },
    );

    expect(result.ok).toBe(false);
    expect(result.intent).toBe("unknown");
    expect(result.errors).toContain("commandText is required");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("summarize_threat narrates emitted events and never calls fetch", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    // Mark four events as emitted so the handler has something to recap.
    const events = store.rows.get("demo_events") ?? [];
    for (let i = 0; i < 4; i += 1) {
      events[i]!["status"] = "emitted";
      events[i]!["emitted_at"] = new Date(2024, 0, 1, 0, 0, i).toISOString();
    }

    const result = await handleVoiceCommand(
      { commandText: "Summarize the threat" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("summarize_threat");
    expect(result.matchedExample).toBe("Summarize the threat");
    expect(result.spokenSummary).toContain(
      INVESTOR_DEMO_SCENARIO.client.client_name,
    );
    expect(result.action?.type).toBe("narrate");
    expect(result.action?.payload["recent_event_count"]).toBe(3); // last 3
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("summarize_threat handles the case where no events have fired", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleVoiceCommand(
      { commandText: "Summarize the threat" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("summarize_threat");
    expect(result.spokenSummary).toMatch(/no simulated events have fired/i);
    expect(result.action?.payload["recent_event_count"]).toBe(0);
  });

  it("explain_isolation surfaces the agent reasoning when present", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleVoiceCommand(
      { commandText: "Why did you recommend isolation?" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("explain_isolation");
    expect(result.spokenSummary).toMatch(/recommended isolation because/i);
    expect(result.action?.type).toBe("explain_isolation");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explain_isolation explains gracefully when no reasoning exists yet", async () => {
    const { client } = makeMemorySupabase();
    // No seed — `demo_agent_reasoning` is empty.

    const result = await handleVoiceCommand(
      { commandText: "Why did you recommend isolation?" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("explain_isolation");
    expect(result.spokenSummary).toMatch(/has not yet been recommended/i);
  });

  it("generate_report writes a new executive report row", async () => {
    const { client, store } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleVoiceCommand(
      { commandText: "Generate the executive report" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("generate_report");
    expect(result.action?.type).toBe("generate_report");
    expect(result.action?.payload["report_id"]).toBeTruthy();
    expect(result.action?.payload["report_title"]).toMatch(/^Executive Report/);
    expect(result.spokenSummary).toMatch(/generated/i);

    const reportRows = store.rows.get("demo_reports") ?? [];
    expect(reportRows.length).toBe(
      INVESTOR_DEMO_SCENARIO.report_templates.length + 1,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("describe_compliance returns the framework list", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleVoiceCommand(
      { commandText: "What is the compliance impact?" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("describe_compliance");
    expect(result.action?.type).toBe("describe_compliance");
    const frameworks = result.action?.payload["frameworks"] as string[];
    expect(frameworks).toEqual([
      ...INVESTOR_DEMO_SCENARIO.client.compliance_frameworks,
    ]);
    expect(result.spokenSummary).toContain("HIPAA");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns intent='unknown' with a no_op action for unrelated input", async () => {
    const { client } = makeMemorySupabase();
    await handleSeed({ supabase: client });

    const result = await handleVoiceCommand(
      { commandText: "Make me a sandwich" },
      { supabase: client },
    );

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("unknown");
    expect(result.matchedExample).toBeNull();
    expect(result.action?.type).toBe("no_op");
    expect(result.spokenSummary).toMatch(/did not recognise/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
