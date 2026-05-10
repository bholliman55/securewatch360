/**
 * Digital twin security state engine — coordinates snapshots, history, diffs, paths, playback, overlays.
 */

import { diffSnapshots } from "./diffEngine";
import { deriveAttackPathsFromSnapshot, diffAttackPathSets } from "./attackPathTracking";
import { PostureHistoryStore } from "./postureHistory";
import { collectPlayback } from "./playback";
import { createSecurityPostureSnapshot, type CreateSnapshotInput } from "./snapshot";
import { applySimulationOverlay } from "./simulationOverlay";
import type {
  TwinAttackPath,
  TwinSecurityPostureDiff,
  TwinSecurityPostureSnapshot,
  TwinSimulationOverlay,
} from "./types";

export class DigitalTwinSecurityStateEngine {
  readonly tenantId: string;
  readonly history: PostureHistoryStore;

  private seq = 0;

  constructor(tenantId: string, historyOptions?: ConstructorParameters<typeof PostureHistoryStore>[0]) {
    this.tenantId = tenantId;
    this.history = new PostureHistoryStore(historyOptions);
  }

  /** Current sequence counter (last appended). */
  get lastSequence(): number {
    return this.seq;
  }

  /**
   * Ingest a new posture slice and append to history.
   */
  capture(input: Omit<CreateSnapshotInput, "tenantId" | "sequence"> & { sequence?: number }): TwinSecurityPostureSnapshot {
    const sequence = input.sequence ?? this.seq + 1;
    this.seq = Math.max(this.seq, sequence);
    const snapshot = createSecurityPostureSnapshot({
      ...input,
      tenantId: this.tenantId,
      sequence,
    });
    this.history.append(snapshot);
    return snapshot;
  }

  latest(): TwinSecurityPostureSnapshot | undefined {
    return this.history.latest();
  }

  diffLatestWith(previous: TwinSecurityPostureSnapshot): TwinSecurityPostureDiff {
    const cur = this.latest();
    if (!cur) throw new Error("DigitalTwinSecurityStateEngine: no snapshots in history");
    return diffSnapshots(previous, cur);
  }

  attackPathsForLatest(): TwinAttackPath[] {
    const cur = this.latest();
    if (!cur) return [];
    return deriveAttackPathsFromSnapshot(cur);
  }

  attackPathDeltaSince(previousSnapshot: TwinSecurityPostureSnapshot): ReturnType<typeof diffAttackPathSets> {
    const before = deriveAttackPathsFromSnapshot(previousSnapshot);
    const cur = this.latest();
    if (!cur) return { newPaths: [], removedFingerprints: [] };
    const after = deriveAttackPathsFromSnapshot(cur);
    return diffAttackPathSets(before, after);
  }

  playback(startIndex?: number, endIndex?: number) {
    return collectPlayback(this.history, startIndex, endIndex);
  }

  /**
   * Fork latest (or provided) snapshot through a simulation overlay without appending to history.
   */
  previewOverlay(overlay: TwinSimulationOverlay, base?: TwinSecurityPostureSnapshot): TwinSecurityPostureSnapshot {
    const b = base ?? this.latest();
    if (!b) throw new Error("DigitalTwinSecurityStateEngine: no base snapshot for overlay");
    return applySimulationOverlay(b, overlay);
  }

  /**
   * Append overlay materialization as a new captured snapshot (simulation run committed to history).
   */
  commitOverlay(overlay: TwinSimulationOverlay, base?: TwinSecurityPostureSnapshot): TwinSecurityPostureSnapshot {
    const projected = this.previewOverlay(overlay, base);
    this.seq += 1;
    const committed: TwinSecurityPostureSnapshot = {
      ...projected,
      sequence: this.seq,
      capturedAt: new Date().toISOString(),
    };
    this.history.append(committed);
    return committed;
  }
}
