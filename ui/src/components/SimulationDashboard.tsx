/**
 * Investor / SOC lab briefing surfaced from persisted simulator dashboard_summary.
 * Visual language follows SecureWatch `--sw-*` tokens (oceanic SOC deck).
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
  LineChart,
} from "lucide-react";
import type { SimulationDashboardSummaryUi } from "../types/simulationDashboard";

async function fetchLatestSummary(signal: AbortSignal): Promise<SimulationDashboardSummaryUi | null> {
  const res = await fetch("/api/simulation/dashboard-summary", { signal, credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.summary ?? null) as SimulationDashboardSummaryUi | null;
}

async function fetchServerDemoMode(signal: AbortSignal): Promise<boolean> {
  const res = await fetch("/api/simulation/demo-mode", { signal, credentials: "include" });
  if (!res.ok) return false;
  const data = (await res.json()) as { simulationDemoMode?: unknown };
  return data.simulationDemoMode === true;
}

function statusTone(status: SimulationDashboardSummaryUi["status"]): string {
  switch (status) {
    case "passed":
      return "text-[var(--sw-success)] shadow-[0_0_28px_-8px_var(--sw-success)]";
    case "partial":
      return "text-[#fbbf24] shadow-[0_0_28px_-8px_rgba(251,191,36,0.45)]";
    default:
      return "text-[#f97316] shadow-[0_0_28px_-8px_rgba(249,115,22,0.45)]";
  }
}

export default function SimulationDashboard() {
  const [summary, setSummary] = useState<SimulationDashboardSummaryUi | null>(null);
  const [serverDemoMode, setServerDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const ac = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const [next, demoSrv] = await Promise.all([
        fetchLatestSummary(ac.signal),
        fetchServerDemoMode(ac.signal),
      ]);
      setSummary(next);
      setServerDemoMode(demoSrv);
      if (!next) setError("No lab run on disk yet, or summary field missing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load simulation summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto animate-[slideIn_0.55s_ease-out_forwards]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle,_rgba(0,229,255,0.20)_0%,_transparent_65%)] blur-md" />
            <div className="relative rounded-2xl border border-[var(--sw-border)] bg-[linear-gradient(160deg,var(--sw-surface-elevated)_0%,rgba(17,45,78,0.55)_120%)] p-4 shadow-[var(--sw-card-shadow)]">
              <FlaskConical className="w-9 h-9 text-[var(--sw-accent-bright)] drop-shadow-[0_0_10px_rgba(41,182,246,0.45)]" />
            </div>
          </div>
          <div>
            <p className="sw-kicker tracking-[0.22em]">Simulation lab briefing</p>
            <h3 className="text-3xl lg:text-4xl font-semibold text-[var(--sw-text-primary)] leading-tight">
              Golden-path narratives, distilled for dashboards
            </h3>
            <p className="mt-2 text-sm text-[var(--sw-text-muted)] max-w-2xl">
              Pulls the latest{" "}
              <code className="text-xs text-[var(--sw-accent-bright)] px-1.5 py-0.5 rounded-md bg-black/25">dashboard_summary</code> from{" "}
              <code className="text-xs text-[var(--sw-accent-bright)] px-1.5 py-0.5 rounded-md bg-black/25">.simulation-results</code> via Next.js API. Run{" "}
              <code className="text-[11px] text-[var(--sw-pulse)]">npm run sim:run</code> while Next is on{" "}
              <code className="text-[11px] text-[var(--sw-pulse)]">:3000</code>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[linear-gradient(125deg,var(--sw-accent-hover),var(--sw-accent)_45%)] text-white font-semibold text-sm hover:brightness-110 active:brightness-95 shadow-[var(--sw-card-shadow)] border border-[var(--sw-border)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh summary
        </button>
      </div>

      {(serverDemoMode || summary?.simulation_demo_mode) && (
        <div className="rounded-xl border border-amber-500/35 bg-[rgba(251,191,36,0.07)] px-5 py-4 text-[var(--sw-text-muted)] text-sm leading-relaxed space-y-2">
          <div className="flex items-center gap-2 text-amber-200 font-semibold">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Demonstration / simulated data</span>
          </div>
          {serverDemoMode && (
            <p>
              Server flag <code className="text-[11px] text-amber-100/90 px-1.5 py-0.5 rounded bg-black/30">SIMULATION_DEMO_MODE</code> is on —
              new simulator runs default to fictitious MSSP clients and local-only orchestration.
            </p>
          )}
          {summary?.simulation_demo_mode && (
            <p>
              {summary.demo_disclaimer ?? "This dashboard summary was produced in demo rehearsal mode."}
              {summary.demo_client_display_name ? (
                <>
                  {" "}
                  <span className="text-[var(--sw-accent-bright)]">Fixture client:</span> {summary.demo_client_display_name}.
                </>
              ) : null}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.06)] px-5 py-4 text-[var(--sw-text-muted)] text-sm leading-relaxed">
          {error}
        </div>
      )}

      {loading && !summary && (
        <div className="sw-panel h-72 flex items-center justify-center text-[var(--sw-text-muted)]">
          Loading simulation dashboard summary…
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          <div className="sw-panel p-6 md:p-7 relative overflow-hidden" style={{ animation: "slideIn 0.5s ease-out 40ms both" }}>
            <div className="absolute -left-[5.25rem] top-10 h-40 w-40 rotate-[15deg] rounded-full border border-[var(--sw-border)] opacity-35 pointer-events-none" />
            <div className="flex flex-wrap justify-between gap-6 relative">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--sw-text-muted)] mb-3">Scenario</p>
                <h4 className="text-2xl md:text-[1.85rem] text-[var(--sw-text-primary)] font-bold leading-snug mb-3">{summary.scenarioName}</h4>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`sw-chip capitalize border-[var(--sw-border)] font-bold ${statusTone(summary.status)}`}>{summary.status}</span>
                  <span className="text-xs text-[var(--sw-text-muted)] font-mono tracking-tight truncate max-w-[min(100vw-4rem,28rem)]">
                    run {summary.runId}
                  </span>
                </div>
              </div>
              <div className="text-right md:min-w-[200px]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--sw-text-muted)] mb-3">Autonomy</p>
                <div className="text-[3.25rem] leading-none font-bold text-[var(--sw-text-primary)] tabular-nums tracking-tighter">
                  {summary.autonomyScore}
                  <span className="text-xl text-[var(--sw-accent-bright)] ml-1">/</span>
                  <span className="text-xl text-[var(--sw-text-muted)]">100</span>
                </div>
                <p className="text-sm text-[var(--sw-accent-bright)] mt-2 font-semibold">{summary.autonomyReadinessLabel}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="sw-panel p-5 border border-[var(--sw-border)]/80" style={{ animation: "slideIn 0.5s ease-out 80ms both" }}>
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-black/35 border border-[var(--sw-border)] p-3">
                  <Users className="w-6 h-6 text-[var(--sw-accent-bright)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--sw-text-muted)] mb-3">Agents passed</p>
                  <p className="text-4xl font-bold tabular-nums text-[var(--sw-text-primary)]">{summary.agentsPassed}</p>
                  <p className="text-[13px] text-[var(--sw-text-muted)] mt-3">SecureWatch validation lane.</p>
                </div>
              </div>
            </div>

            <div className="sw-panel p-5 border border-[var(--sw-border)]/80" style={{ animation: "slideIn 0.5s ease-out 120ms both" }}>
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-black/35 border border-[var(--sw-border)] p-3">
                  <ShieldAlert className="w-6 h-6 text-[#fbbf24]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--sw-text-muted)] mb-3">Agents failed</p>
                  <p className="text-4xl font-bold tabular-nums text-[var(--sw-text-primary)]">{summary.agentsFailed}</p>
                  <p className="text-[13px] text-[var(--sw-text-muted)] mt-3">
                    {summary.agentsFailed === 0 ? "All checklist validators acknowledged." : "Review audit/Inngest fidelity."}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="sw-panel p-5 border border-[var(--sw-border)]/80 lg:col-span-2"
              style={{ animation: "slideIn 0.5s ease-out 160ms both" }}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-black/35 border border-[var(--sw-border)] p-3 shrink-0">
                  <Activity className="w-6 h-6 text-[var(--sw-pulse)]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--sw-text-muted)] mb-3">Controls validated</p>
                  <p className="text-sm text-[var(--sw-text-muted)] leading-relaxed">{summary.controlsValidated}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="sw-panel p-5 border border-[var(--sw-border)]/80 md:col-span-2 lg:col-span-4" style={{ animation: "slideIn 0.5s ease-out 190ms both" }}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-black/35 border border-[var(--sw-border)] p-3 shrink-0">
                <LineChart className="w-6 h-6 text-[var(--sw-accent-hover)]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--sw-text-muted)] mb-3">Remediation status</p>
                <p className="text-sm text-[var(--sw-text-muted)] leading-relaxed">{summary.remediationStatus}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="sw-panel p-6 lg:p-7 border-[var(--sw-border)]" style={{ animation: "slideIn 0.55s ease-out 220ms both" }}>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-5 h-5 text-[var(--sw-accent-bright)]" />
                <h5 className="text-lg font-bold text-[var(--sw-text-primary)]">Executive summary</h5>
              </div>
              <p className="text-[var(--sw-text-muted)] leading-relaxed text-[15px]">{summary.executiveSummary}</p>
            </div>
            <div className="sw-panel p-6 lg:p-7 border-[var(--sw-border)]" style={{ animation: "slideIn 0.55s ease-out 260ms both" }}>
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-[var(--sw-pulse)]" />
                <h5 className="text-lg font-bold text-[var(--sw-text-primary)]">Technical synopsis</h5>
              </div>
              <p className="font-mono text-[12px] text-[var(--sw-text-muted)] leading-relaxed">{summary.technicalSummary}</p>
              <div className="mt-6 p-4 rounded-xl bg-black/35 border border-dashed border-[var(--sw-border)]">
                <p className="sw-kicker text-[10px] mb-2 opacity-95">Recommended next step</p>
                <p className="text-sm text-[var(--sw-accent-bright)] font-medium leading-snug">{summary.nextRecommendedAction}</p>
              </div>
            </div>
          </div>

          <div className="sw-panel p-7 border-[var(--sw-border)]" style={{ animation: "slideIn 0.6s ease-out 300ms both" }}>
            <div className="flex flex-wrap justify-between gap-4 mb-6">
              <div>
                <p className="sw-kicker mb-1">Timeline choreography</p>
                <h5 className="text-xl font-semibold text-[var(--sw-text-primary)]">Synthetic playbook cadence</h5>
              </div>
              <span className="text-xs uppercase tracking-[0.22em] text-[var(--sw-text-muted)] self-center">{summary.timelineEvents.length} beats</span>
            </div>
            <div className="relative pl-10 space-y-5 before:absolute before:left-4 before:top-2 before:bottom-5 before:w-px before:bg-gradient-to-b before:from-[var(--sw-accent-hover)] before:via-[var(--sw-border)] before:to-transparent">
              {summary.timelineEvents.map((evt, idx) => (
                <div key={`${evt.phase}-${idx}`} className="relative">
                  <div className="absolute -left-[1.625rem] top-3 h-3 w-3 rounded-full bg-[var(--sw-accent-hover)] shadow-[0_0_22px_-2px_var(--sw-accent-hover)] ring-4 ring-black/55" />
                  <div className="flex flex-wrap items-baseline gap-3 mb-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--sw-pulse)]">T + {evt.t_offset_seconds}s</span>
                    <span className="font-mono text-sm text-[var(--sw-accent-bright)]">{evt.phase}</span>
                  </div>
                  <p className="text-[var(--sw-text-muted)] text-sm leading-relaxed">{evt.narrative}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
