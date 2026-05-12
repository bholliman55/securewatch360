export type AiCostLine = {
  decision_id: string;
  tenant_id: string;
  model_id: string;
  recorded_at: string;
  prompt_tokens: number;
  completion_tokens: number;
  /** Rough USD estimate from caller (provider billing); governance uses for chargeback / budgets. */
  estimated_usd: number;
};

/**
 * Per-decision cost aggregation — replace backing store with warehouse billing export in production.
 */
export class AiCostTracker {
  private readonly lines: AiCostLine[] = [];

  record(line: Omit<AiCostLine, "recorded_at"> & { recorded_at?: string }): void {
    this.lines.push({
      ...line,
      recorded_at: line.recorded_at ?? new Date().toISOString(),
    });
  }

  totalUsdForDecision(decisionId: string): number {
    return this.lines.filter((l) => l.decision_id === decisionId).reduce((s, l) => s + l.estimated_usd, 0);
  }

  tokensForDecision(decisionId: string): { prompt: number; completion: number } {
    return this.lines
      .filter((l) => l.decision_id === decisionId)
      .reduce(
        (acc, l) => ({
          prompt: acc.prompt + l.prompt_tokens,
          completion: acc.completion + l.completion_tokens,
        }),
        { prompt: 0, completion: 0 },
      );
  }

  snapshot(): readonly AiCostLine[] {
    return this.lines;
  }

  clearForTests(): void {
    this.lines.length = 0;
  }
}
