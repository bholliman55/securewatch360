/**
 * Demo simulation mode — isolates rehearsals from orchestration adapters that could enqueue real work.
 */

import type { SimulatedEvent } from "../types";

export type SimulatorOrchestrationSinkName = "local" | "supabase" | "inngest";
import { pickDemoClientForScenario, type DemoClientFixture } from "./demoClients";
import { primaryDemoAssetForClient } from "./demoAssets";

/** Environment toggle (UI/CLI/process). When true, emits stay on the local synthetic sink unless explicitly overridden downstream. */
export const SIMULATION_DEMO_MODE_ENV_VAR = "SIMULATION_DEMO_MODE" as const;

export function readSimulationDemoModeFromEnv(): boolean {
  const v = process.env[SIMULATION_DEMO_MODE_ENV_VAR]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Resolved demo flag — explicit CLI/API `true` wins; explicit `false` disables even if env says on.
 */
export function resolveSimulationDemoMode(explicit?: boolean): boolean {
  if (explicit === false) return false;
  if (explicit === true) return true;
  return readSimulationDemoModeFromEnv();
}

export interface DemoSimulationContext {
  simulation_demo_mode: true;
  client: DemoClientFixture;
  headline_asset_hostname: string;
  remediation_blocked_live_execution: true;
}

export function buildDemoSimulationContext(scenarioId: string): DemoSimulationContext {
  const client = pickDemoClientForScenario(scenarioId);
  const primary = primaryDemoAssetForClient(client);
  return {
    simulation_demo_mode: true,
    client,
    headline_asset_hostname: primary.hostname,
    remediation_blocked_live_execution: true,
  };
}

/** Demo safety: never enqueue Supabase audit rows nor Inngest events that could hydrate production workloads. */
export function coerceOrchestrationModeForSimulationDemo(_requested: SimulatorOrchestrationSinkName): SimulatorOrchestrationSinkName {
  return "local";
}

const DEMO_MARKER = {
  sw360_simulation_demo: true,
  data_classification: "simulated_demo_only",
  remediation_live_execution_blocked: true,
  /** Truthfulness — demo outcomes are scripted for narrative fidelity, not field telemetry. */
  demo_truthfulness: "scenario_fixture_narrative_not_customer_telemetry",
} as const;

/**
 * Annotate stamped events so downstream validators, audit exports, and UI treat rows as illustrative only.
 */
export function annotateSimulatedEventsForDemo(
  events: SimulatedEvent[],
  demo: DemoSimulationContext,
): SimulatedEvent[] {
  const client = demo.client;
  const primary = primaryDemoAssetForClient(client);
  return events.map((evt) => {
    const remediationExtra =
      evt.kind === "remediation.execution.synthetic"
        ? {
            remediation_execution_plane: "simulated_lab_only",
            live_change_management_blocked: true,
          }
        : {};

    const basePayload = evt.payload ?? {};
    const enrichedPayload = {
      ...basePayload,
      demo_fixture_organization: client.display_name,
      demo_fixture_client_slug: client.slug,
      demo_fixture_tenant_id: client.id,
      demo_fixture_hostname: typeof basePayload.device_hostname === "string" ? basePayload.device_hostname : primary.hostname,
      ...remediationExtra,
    };

    return {
      ...evt,
      tenantId: evt.tenantId ?? client.id,
      metadata: {
        ...(evt.metadata ?? {}),
        ...DEMO_MARKER,
        demo_fixture_client_display_name: client.display_name,
        demo_fixture_vertical: client.vertical,
        demo_fixture_asset_anchor: primary.id,
      },
      payload: enrichedPayload,
    };
  });
}

export function buildDemoTechnicalSummarySuffix(orchestrationModeUsed: SimulatorOrchestrationSinkName): string {
  return `demo_mode · orchestration_sink ${orchestrationModeUsed} · live_remediation_execution blocked · inngest_and_remote_playbooks suppressed`;
}
