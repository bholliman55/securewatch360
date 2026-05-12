import type { KillChainStage } from "./types";

/** Display order for dashboard swimlanes. */
export const KILL_CHAIN_ORDER: KillChainStage[] = [
  "reconnaissance",
  "weaponization",
  "delivery",
  "exploitation",
  "installation",
  "command_and_control",
  "actions_on_objectives",
];

const LABELS: Record<KillChainStage, string> = {
  reconnaissance: "Reconnaissance",
  weaponization: "Weaponization",
  delivery: "Delivery",
  exploitation: "Exploitation",
  installation: "Installation",
  command_and_control: "Command and Control",
  actions_on_objectives: "Actions on Objectives",
};

export function killChainStageLabel(stage: KillChainStage): string {
  return LABELS[stage];
}

/**
 * Approximate mapping from MITRE tactic id (see mitre.ts) to kill-chain lane for swimlane charts.
 */
export function killChainStageFromMitreTacticId(tacticId: string): KillChainStage {
  switch (tacticId) {
    case "discovery":
      return "reconnaissance";
    case "initial-access":
      return "delivery";
    case "execution":
    case "privilege-escalation":
    case "defense-evasion":
      return "exploitation";
    case "persistence":
    case "credential-access":
      return "installation";
    case "lateral-movement":
    case "command-and-control":
      return "command_and_control";
    case "collection":
    case "exfiltration":
    case "impact":
      return "actions_on_objectives";
    default:
      return "exploitation";
  }
}
