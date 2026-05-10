/**
 * Historical playback — iterate posture history with optional diff between steps.
 */

import { diffSnapshots } from "./diffEngine";
import type { PostureHistoryStore } from "./postureHistory";
import type { TwinSecurityPostureDiff, TwinSecurityPostureSnapshot } from "./types";

export type PlaybackFrame = {
  index: number;
  snapshot: TwinSecurityPostureSnapshot;
  diffFromPrevious: TwinSecurityPostureDiff | null;
};

/**
 * Yield frames from history [startIndex, endIndex] inclusive.
 */
export function* playbackHistory(
  store: PostureHistoryStore,
  startIndex = 0,
  endIndex?: number,
): Generator<PlaybackFrame> {
  const all = [...store.all()];
  const end = endIndex ?? all.length - 1;
  for (let i = Math.max(0, startIndex); i <= end && i < all.length; i += 1) {
    const snapshot = all[i]!;
    const prev = i > 0 ? all[i - 1]! : null;
    const diffFromPrevious = prev ? diffSnapshots(prev, snapshot) : null;
    yield { index: i, snapshot, diffFromPrevious };
  }
}

export function collectPlayback(
  store: PostureHistoryStore,
  startIndex = 0,
  endIndex?: number,
): PlaybackFrame[] {
  return [...playbackHistory(store, startIndex, endIndex)];
}
