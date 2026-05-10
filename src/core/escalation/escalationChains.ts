/**
 * Escalation chain definitions — ordered tiers with channel sets and activation delays.
 */

import type { EscalationChainDefinition, EscalationChainStep } from "./types";

const DEFAULT_CHAIN: EscalationChainDefinition = {
  id: "sw360.default.hitl",
  name: "Default HITL escalation",
  steps: [
    { tier: 0, activateAfterMinutes: 0, channels: ["email"], label: "Primary approver email" },
    { tier: 1, activateAfterMinutes: 30, channels: ["slack", "email"], label: "Slack + email" },
    { tier: 2, activateAfterMinutes: 60, channels: ["teams", "sms"], label: "Teams + SMS" },
    { tier: 3, activateAfterMinutes: 120, channels: ["slack", "teams", "email", "sms"], label: "Full executive" },
  ],
};

const chains = new Map<string, EscalationChainDefinition>([[DEFAULT_CHAIN.id, DEFAULT_CHAIN]]);

export function registerEscalationChain(def: EscalationChainDefinition): void {
  chains.set(def.id, def);
}

export function getEscalationChain(id: string): EscalationChainDefinition | undefined {
  return chains.get(id);
}

export function getDefaultEscalationChain(): EscalationChainDefinition {
  return DEFAULT_CHAIN;
}

export function nextTierStep(
  chain: EscalationChainDefinition,
  currentTier: number,
): EscalationChainStep | null {
  const sorted = [...chain.steps].sort((a, b) => a.tier - b.tier);
  const next = sorted.find((s) => s.tier > currentTier);
  return next ?? null;
}

export function stepForTier(chain: EscalationChainDefinition, tier: number): EscalationChainStep | undefined {
  return chain.steps.find((s) => s.tier === tier);
}
