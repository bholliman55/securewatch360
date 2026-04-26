export interface LlmCompleteRequest {
  model: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface LlmCompleteResponse {
  content: string;
  parsedJson?: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  rawResponse?: unknown;
}

export interface LlmProviderAdapter {
  readonly providerName: string;
  complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse>;
}
