/**
 * Timeout escalation — advance tier when the next tier's delay has elapsed without resolution.
 */

import type { ApprovalQueueItem } from "./types";
import { getDefaultEscalationChain, getEscalationChain, nextTierStep } from "./escalationChains";

export type TimeoutCheckResult =
  | { action: "none"; reason: string }
  | { action: "advance_tier"; nextTier: number; next_deadline_at: string | null; reason: string }
  | { action: "expire"; reason: string };

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

const MAX_PENDING_DAYS = 7;

/**
 * If `asOfIso` is past the deadline for the current tier, the next tier should activate.
 * Reference time for the next tier's delay is `last_escalation_at` (when current tier was entered) or `created_at` for tier 0.
 */
export function evaluateTimeoutEscalation(
  item: ApprovalQueueItem,
  asOfIso: string,
): TimeoutCheckResult {
  if (item.status !== "pending" && item.status !== "awaiting_info") {
    return { action: "none", reason: "not_active" };
  }

  const chain = getEscalationChain(item.chain_id) ?? getDefaultEscalationChain();
  const next = nextTierStep(chain, item.current_tier);

  if (!next) {
    const asOfMs = new Date(asOfIso).getTime();
    const createdMs = new Date(item.created_at).getTime();
    const maxMs = MAX_PENDING_DAYS * 24 * 60 * 60 * 1000;
    if (asOfMs - createdMs > maxMs) {
      return { action: "expire", reason: "max_pending_age" };
    }
    return { action: "none", reason: "at_final_tier" };
  }

  const tierEnteredAt = item.last_escalation_at ?? item.created_at;
  const escalateAt = addMinutes(tierEnteredAt, next.activateAfterMinutes);

  if (asOfIso < escalateAt) {
    return { action: "none", reason: "within_tier_window" };
  }

  const following = nextTierStep(chain, next.tier);
  const next_deadline_at = following
    ? addMinutes(asOfIso, following.activateAfterMinutes)
    : null;

  return {
    action: "advance_tier",
    nextTier: next.tier,
    next_deadline_at,
    reason: "tier_timeout_elapsed",
  };
}
