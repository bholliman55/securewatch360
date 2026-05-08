"use client";

/**
 * InvestorDemoShell — the *only* stateful component in the Investor Mode UI.
 *
 * Responsibilities:
 *   1. Fetch initial snapshot from `GET /api/demo/investor/state` on mount
 *      (or accept one rendered server-side via the `initialState` prop).
 *   2. Subscribe to Supabase realtime postgres_changes on the four demo_*
 *      tables that mutate during a run. When realtime is unavailable the
 *      poll fallback keeps the snapshot fresh on a 1.5s cadence while a
 *      replay is live.
 *   3. Expose stable `onSeed / onReset / onStart / onPause / onResume / onStop /
 *      onGenerateReport` callbacks for the control panel.
 *   4. Compose the three-column layout with all of the dumb display panels.
 *
 * The page (`src/app/investor-demo/page.tsx`) is a server component that
 * server-renders the initial snapshot for fast first paint and hands it to
 * this client component.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase";

import { DemoAgentReasoningPanel } from "./DemoAgentReasoningPanel";
import { DemoAssetMap } from "./DemoAssetMap";
import { DemoBusinessImpactPanel } from "./DemoBusinessImpactPanel";
import { DemoClientRiskPanel } from "./DemoClientRiskPanel";
import { DemoCompliancePanel } from "./DemoCompliancePanel";
import { DemoControlPanel } from "./DemoControlPanel";
import { DemoExecutiveSummary } from "./DemoExecutiveSummary";
import { DemoTimeline } from "./DemoTimeline";
import { DemoVoicePanel } from "./DemoVoicePanel";
import {
  EMPTY_INVESTOR_DEMO_STATE,
  type InvestorDemoState,
} from "./types";

const POLL_INTERVAL_MS = 1500;

interface InvestorDemoShellProps {
  /** Server-rendered initial snapshot (avoids a flash of empty UI). */
  initialState?: InvestorDemoState;
}

export function InvestorDemoShell({
  initialState,
}: InvestorDemoShellProps): React.JSX.Element {
  const [state, setState] = useState<InvestorDemoState>(
    initialState ?? EMPTY_INVESTOR_DEMO_STATE,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshState = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/demo/investor/state", {
        cache: "no-store",
      });
      if (!res.ok) {
        setLastError(`state fetch failed: ${res.status}`);
        return;
      }
      const next = (await res.json()) as InvestorDemoState;
      setState(next);
      if (next.errors.length > 0) {
        setLastError(next.errors[0] ?? null);
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Initial fetch + realtime subscription + poll fallback
  // ---------------------------------------------------------------------------

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  // Supabase realtime: subscribe to changes on the four mutating tables for
  // the canonical scenario_key. We re-fetch the full snapshot on any change
  // — simpler and more correct than reconciling diffs in the client, given
  // the modest table sizes.
  const scenarioKey = state.scenarioKey || EMPTY_INVESTOR_DEMO_STATE.scenarioKey;
  useEffect(() => {
    if (!scenarioKey) return;
    let cancelled = false;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return; // env not configured — polling will keep things fresh
    }
    const channel = supabase.channel(`demo:investor:${scenarioKey}`);

    const tables = ["demo_events", "demo_assets", "demo_actions", "demo_scenarios"] as const;
    for (const table of tables) {
      channel.on(
        // The `postgres_changes` event name uses snake_case in supabase-js v2.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          filter: `scenario_key=eq.${scenarioKey}`,
        },
        () => {
          if (!cancelled) void refreshState();
        },
      );
    }

    channel.subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [scenarioKey, refreshState]);

  // Polling fallback while a replay is running. Cheap and bounded — the
  // /state endpoint is a parallel batch of small queries.
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReplayLive =
    state.replay.hasActive && state.replay.state === "running";

  useEffect(() => {
    if (!isReplayLive) {
      if (pollerRef.current) clearInterval(pollerRef.current);
      pollerRef.current = null;
      return;
    }
    pollerRef.current = setInterval(() => {
      void refreshState();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
      pollerRef.current = null;
    };
  }, [isReplayLive, refreshState]);

  // ---------------------------------------------------------------------------
  // Control actions
  // ---------------------------------------------------------------------------

  const callApi = useCallback(
    async (
      label: string,
      path: string,
      init?: RequestInit,
    ): Promise<boolean> => {
      setBusy(label);
      setLastError(null);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...init,
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          reason?: string;
        };
        if (!res.ok || body.ok === false) {
          setLastError(body.error ?? body.reason ?? `${label} failed`);
          return false;
        }
        return true;
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(null);
        await refreshState();
      }
    },
    [refreshState],
  );

  const onSeed = useCallback(
    () => callApi("Seed Demo", "/api/demo/investor/seed"),
    [callApi],
  );
  const onReset = useCallback(
    () => callApi("Reset Demo", "/api/demo/investor/reset"),
    [callApi],
  );
  const onStart = useCallback(
    () =>
      callApi("Start Simulation", "/api/demo/investor/start", {
        body: JSON.stringify({ speedMultiplier: 1 }),
      }),
    [callApi],
  );
  const onRunFast = useCallback(
    () =>
      callApi("Run Fast", "/api/demo/investor/start", {
        body: JSON.stringify({ speedMultiplier: 5 }),
      }),
    [callApi],
  );
  const onPause = useCallback(
    () => callApi("Pause", "/api/demo/investor/pause"),
    [callApi],
  );
  const onResume = useCallback(
    () => callApi("Resume", "/api/demo/investor/resume"),
    [callApi],
  );
  const onStop = useCallback(
    () => callApi("Stop", "/api/demo/investor/stop"),
    [callApi],
  );
  const onGenerateReport = useCallback(
    () => callApi("Generate Report", "/api/demo/investor/report"),
    [callApi],
  );

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const emittedEvents = useMemo(
    () => state.events.filter((e) => e.status === "emitted"),
    [state.events],
  );
  const latestEmitted = emittedEvents[emittedEvents.length - 1] ?? null;
  const reasoningForLatest = useMemo(() => {
    if (!latestEmitted) return null;
    return (
      state.reasoning.find(
        (r) => r.event_type === latestEmitted.event_type,
      ) ?? null
    );
  }, [latestEmitted, state.reasoning]);

  const currentAction = useMemo(() => {
    // Prefer the action whose status is most progressed.
    const order = [
      "executed",
      "confirmed",
      "awaiting_confirmation",
      "pending",
      "failed",
      "cancelled",
    ] as const;
    return [...state.actions]
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0]
      ?? null;
  }, [state.actions]);

  const scenarioStatus = state.scenario?.status ?? "ready";
  const seedReportTemplates = useMemo(
    () => state.reports.filter((r) => r.title.startsWith("Seed: ")),
    [state.reports],
  );
  const generatedReports = useMemo(
    () => state.reports.filter((r) => !r.title.startsWith("Seed: ")),
    [state.reports],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ----- Top header ----- */}
      <header
        aria-labelledby="investor-demo-title"
        className="border-b border-gray-200 bg-white"
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-4">
            <span className="text-base font-semibold tracking-tight text-gray-900">
              SecureWatch360
            </span>
            <h1
              id="investor-demo-title"
              className="text-sm font-medium uppercase tracking-wider text-gray-500"
            >
              Investor Demo Mode
            </h1>
            <ScenarioStatusBadge status={scenarioStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Client:</span>{" "}
              <span className="font-medium text-gray-900">
                {state.client?.client_name ?? "Acme Dental"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">MSP:</span>{" "}
              <span className="font-medium text-gray-900">
                {state.client?.msp_name ?? "Northstar Managed IT"}
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 bg-white">
          <div className="mx-auto max-w-[1400px] px-6 py-3">
            <DemoControlPanel
              busy={busy}
              scenarioStatus={scenarioStatus}
              replayState={state.replay.state}
              onSeed={onSeed}
              onReset={onReset}
              onStart={onStart}
              onRunFast={onRunFast}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              onGenerateReport={onGenerateReport}
              lastError={lastError}
            />
          </div>
        </div>
      </header>

      {/* ----- Three-column body ----- */}
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-3">
            <DemoClientRiskPanel client={state.client} assets={state.assets} />
            <DemoAssetMap assets={state.assets} />
            <DemoCompliancePanel
              client={state.client}
              reasoning={state.reasoning}
            />
          </div>

          {/* Center column */}
          <div className="space-y-6 lg:col-span-6">
            <DemoTimeline events={state.events} />
            <DemoAgentReasoningPanel
              latestEvent={latestEmitted}
              reasoning={reasoningForLatest}
              currentAction={currentAction}
            />
          </div>

          {/* Right column */}
          <div className="space-y-6 lg:col-span-3">
            <DemoVoicePanel
              spokenSummary={
                latestEmitted
                  ? buildSpokenSummary(latestEmitted.event_type, latestEmitted.title)
                  : null
              }
            />
            <DemoBusinessImpactPanel metrics={state.metrics} />
            <DemoExecutiveSummary
              seedTemplates={seedReportTemplates}
              generatedReports={generatedReports}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSpokenSummary(eventType: string, fallbackTitle: string): string {
  // Mirror the server-side mapping so the UI can show the same line that
  // would have been spoken via ElevenLabs — even if no voice is connected.
  const map: Record<string, string> = {
    demo_started: "SecureWatch is monitoring Acme Dental.",
    detection_powershell:
      "I detected suspicious PowerShell behavior on a Sarah Mitchell endpoint.",
    detection_unusual_file_access:
      "Unusual file access against the Acme file server is in progress.",
    detection_credential_access:
      "Credential access attempts are now in flight on the same endpoint.",
    classification_ransomware_precursor:
      "Agent five classified this as ransomware precursor behavior.",
    correlation_ioc_match:
      "Agent two correlated this with known attacker tradecraft.",
    compliance_impact_assessed:
      "Agent three found potential HIPAA and CMMC impact.",
    containment_recommended:
      "I am recommending immediate isolation of the affected endpoint.",
    voice_confirmation_requested:
      "Requesting voice confirmation from the on-call admin.",
    admin_confirmation_received:
      "Confirmation received. Proceeding with isolation in simulation.",
    endpoint_isolated:
      "Endpoint is now isolated in this controlled simulation.",
    ticket_created:
      "A remediation ticket has been created for the response team.",
    executive_report_generated:
      "Executive report has been generated and is ready for download.",
    business_impact_summary_generated:
      "Business impact summary is ready for the leadership briefing.",
    demo_completed:
      "The Acme Dental simulation is complete.",
  };
  return map[eventType] ?? `${fallbackTitle} (simulated).`;
}

function ScenarioStatusBadge({
  status,
}: {
  status: "ready" | "running" | "completed" | "archived";
}): React.JSX.Element {
  const cls: Record<typeof status, string> = {
    ready: "bg-gray-100 text-gray-700 border-gray-200",
    running: "bg-sky-50 text-sky-700 border-sky-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    archived: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${cls[status]}`}
    >
      {status}
    </span>
  );
}
