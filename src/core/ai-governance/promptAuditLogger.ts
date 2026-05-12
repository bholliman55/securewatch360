import { createHash, randomUUID } from "node:crypto";

export type PromptAuditEntry = {
  audit_id: string;
  tenant_id: string;
  decision_id: string;
  /** sha256 over normalized prompt text — never persist raw prompts containing secrets. */
  prompt_sha256: string;
  model_id: string;
  recorded_at: string;
  prompt_token_count?: number;
  completion_token_count?: number;
  /** Redacted single-line intent for operators (no credentials). */
  task_label: string;
};

/**
 * Redact obvious secret patterns before hashing for audit correlation.
 */
export function redactForAuditFingerprint(text: string): string {
  return text
    .replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\bxox[baprs]-[a-zA-Z0-9-]+\b/gi, "[REDACTED_SLACK]")
    .replace(/\bBearer\s+[a-zA-Z0-9._-]+\b/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]");
}

export function hashPromptForAudit(normalizedPrompt: string): string {
  const body = redactForAuditFingerprint(normalizedPrompt).trim().toLowerCase();
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * In-memory prompt audit ring buffer — swap for append-only store (Postgres, SIEM) in production.
 */
export class PromptAuditLogger {
  private readonly entries: PromptAuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  log(args: Omit<PromptAuditEntry, "audit_id" | "recorded_at" | "prompt_sha256"> & { prompt_text: string }): PromptAuditEntry {
    const prompt_sha256 = hashPromptForAudit(args.prompt_text);
    const entry: PromptAuditEntry = {
      audit_id: randomUUID(),
      recorded_at: new Date().toISOString(),
      prompt_sha256,
      tenant_id: args.tenant_id,
      decision_id: args.decision_id,
      model_id: args.model_id,
      prompt_token_count: args.prompt_token_count,
      completion_token_count: args.completion_token_count,
      task_label: args.task_label,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return entry;
  }

  listForTenant(tenantId: string): PromptAuditEntry[] {
    return this.entries.filter((e) => e.tenant_id === tenantId);
  }

  clearForTests(): void {
    this.entries.length = 0;
  }
}
