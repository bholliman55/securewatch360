import { createHash } from "node:crypto";
import { canonicalStringForSigning, stableSortedJson } from "./internalCanonical";

export const GENESIS_PREV_HASH = "0".repeat(64);

export type AuditChainRecord = {
  seq: number;
  prev_hash: string;
  entry_hash: string;
  /** Canonical JSON of the audited fact (sorted keys). */
  payload_json: string;
  recorded_at_ms: number;
};

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Tamper-evident hash chain for audit exports — each row commits to the full history.
 */
export class AuditHashChain {
  private readonly records: AuditChainRecord[] = [];

  append(payload: Record<string, unknown>, recorded_at_ms = Date.now()): AuditChainRecord {
    const prev = this.records.length === 0 ? GENESIS_PREV_HASH : this.records[this.records.length - 1].entry_hash;
    const payload_json = stableSortedJson(payload);
    const seq = this.records.length;
    const material = canonicalStringForSigning({
      seq,
      prev_hash: prev,
      payload_json,
      recorded_at_ms,
    });
    const entry_hash = sha256Hex(material);
    const rec: AuditChainRecord = {
      seq,
      prev_hash: prev,
      entry_hash,
      payload_json,
      recorded_at_ms,
    };
    this.records.push(rec);
    return rec;
  }

  getRecords(): readonly AuditChainRecord[] {
    return this.records;
  }

  /**
   * Recomputes the chain from stored payloads — false if any link is broken.
   */
  validate(): boolean {
    let prev = GENESIS_PREV_HASH;
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r.seq !== i || r.prev_hash !== prev) return false;
      const material = canonicalStringForSigning({
        seq: r.seq,
        prev_hash: r.prev_hash,
        payload_json: r.payload_json,
        recorded_at_ms: r.recorded_at_ms,
      });
      const expected = sha256Hex(material);
      if (expected !== r.entry_hash) return false;
      prev = r.entry_hash;
    }
    return true;
  }

  clearForTests(): void {
    this.records.length = 0;
  }
}
