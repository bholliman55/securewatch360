/**
 * Posture history — ordered snapshot store for the digital twin (in-memory; persist via caller).
 */

import type { TwinSecurityPostureSnapshot } from "./types";

export type PostureHistoryOptions = {
  maxSnapshots?: number;
};

const DEFAULT_MAX = 500;

export class PostureHistoryStore {
  private readonly snapshots: TwinSecurityPostureSnapshot[] = [];
  private readonly maxSnapshots: number;

  constructor(options?: PostureHistoryOptions) {
    this.maxSnapshots = Math.max(1, options?.maxSnapshots ?? DEFAULT_MAX);
  }

  append(snapshot: TwinSecurityPostureSnapshot): void {
    this.snapshots.push(snapshot);
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  get length(): number {
    return this.snapshots.length;
  }

  at(index: number): TwinSecurityPostureSnapshot | undefined {
    return this.snapshots[index];
  }

  /** Latest snapshot or undefined */
  latest(): TwinSecurityPostureSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  /** All snapshots in capture order */
  all(): readonly TwinSecurityPostureSnapshot[] {
    return this.snapshots;
  }

  /** Snapshots where sequence is in [fromSeq, toSeq] inclusive */
  rangeBySequence(fromSeq: number, toSeq: number): TwinSecurityPostureSnapshot[] {
    return this.snapshots.filter((s) => s.sequence >= fromSeq && s.sequence <= toSeq);
  }

  clear(): void {
    this.snapshots.length = 0;
  }
}
