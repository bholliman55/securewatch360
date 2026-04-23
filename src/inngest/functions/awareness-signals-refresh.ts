import { inngest } from "@/inngest/client";
import { ingestAwarenessSignals } from "@/lib/awarenessSignalIngestion";

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function fetchSignalsFromUrl(url: string | undefined): Promise<string[]> {
  if (!url) return [];
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json, text/plain" },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as unknown;
    if (Array.isArray(payload)) {
      return payload.filter((value): value is string => typeof value === "string");
    }
    if (
      payload &&
      typeof payload === "object" &&
      "signals" in payload &&
      Array.isArray((payload as { signals: unknown[] }).signals)
    ) {
      return (payload as { signals: unknown[] }).signals.filter(
        (value): value is string => typeof value === "string"
      );
    }
    return [];
  } catch {
    return [];
  }
}

export const awarenessSignalsRefresh = inngest.createFunction(
  { id: "awareness-signals-refresh", retries: 1 },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const tenantIds = parseList(process.env.AWARENESS_SIGNAL_TENANT_IDS);
    if (tenantIds.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "AWARENESS_SIGNAL_TENANT_IDS not set",
      };
    }

    const feedRealWorldSignals = await step.run("fetch-real-world-signals", async () =>
      fetchSignalsFromUrl(process.env.AWARENESS_REAL_WORLD_SIGNALS_URL)
    );
    const feedCompanySignals = await step.run("fetch-company-signals", async () =>
      fetchSignalsFromUrl(process.env.AWARENESS_COMPANY_SIGNALS_URL)
    );

    const envRealWorldSignals = parseList(process.env.SECURITY_AWARENESS_REAL_WORLD_SIGNALS);
    const envCompanySignals = parseList(process.env.SECURITY_AWARENESS_COMPANY_SIGNALS);

    const realWorldSignals = Array.from(new Set([...feedRealWorldSignals, ...envRealWorldSignals]));
    const companySignals = Array.from(new Set([...feedCompanySignals, ...envCompanySignals]));

    const perTenant = await step.run("persist-awareness-signals", async () => {
      const results: Array<{
        tenantId: string;
        realWorldIngested: number;
        companyIngested: number;
      }> = [];

      for (const tenantId of tenantIds) {
        const realWorld = await ingestAwarenessSignals({
          tenantId,
          signalType: "real_world",
          source: feedRealWorldSignals.length > 0 ? "scheduled_feed" : "scheduled_env",
          signals: realWorldSignals,
          actorUserId: null,
        });
        const company = await ingestAwarenessSignals({
          tenantId,
          signalType: "company",
          source: feedCompanySignals.length > 0 ? "scheduled_feed" : "scheduled_env",
          signals: companySignals,
          actorUserId: null,
        });
        results.push({
          tenantId,
          realWorldIngested: realWorld.ingestedCount,
          companyIngested: company.ingestedCount,
        });
      }
      return results;
    });

    return {
      ok: true,
      tenantCount: tenantIds.length,
      perTenant,
      signalInputs: {
        realWorldSignals: realWorldSignals.length,
        companySignals: companySignals.length,
      },
    };
  }
);
