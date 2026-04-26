import { estimateTokens } from "@/lib/token-optimization/tokenEstimator";
import { hashText } from "@/lib/token-optimization/promptHash";
import type {
  LlmCompleteRequest,
  LlmCompleteResponse,
  LlmProviderAdapter,
} from "@/lib/token-optimization/providerAdapter";

function truncate(input: string, maxChars: number): string {
  return input.length <= maxChars ? input : `${input.slice(0, maxChars)}...`;
}

export class MockLlmProviderAdapter implements LlmProviderAdapter {
  public readonly providerName = "mock-llm-provider";

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse> {
    const inputTokens = estimateTokens(request.prompt);
    const fingerprint = hashText(`${request.model}:${request.prompt}`).slice(0, 12);
    const synthetic = `Mock(${fingerprint}) ${request.model}: ${truncate(request.prompt.replace(/\s+/g, " "), 220)}`;
    const outputTokens = Math.min(estimateTokens(synthetic), request.maxOutputTokens);
    return {
      content: synthetic,
      parsedJson: undefined,
      inputTokens,
      outputTokens,
      rawResponse: {
        provider: this.providerName,
        deterministicFingerprint: fingerprint,
      },
    };
  }
}
