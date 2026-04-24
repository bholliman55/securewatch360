type RetryableRequest = {
  url: string;
  init: RequestInit;
  attempts?: number;
  initialDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWithRetry(args: RetryableRequest): Promise<Response> {
  const attempts = args.attempts ?? 3;
  const initialDelayMs = args.initialDelayMs ?? 400;
  let delay = initialDelayMs;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(args.url, args.init);
      if (!isRetryableStatus(response.status) || attempt === attempts) {
        return response;
      }
      await sleep(delay);
      delay *= 2;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(delay);
      delay *= 2;
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : "Request failed after retries");
}

export function dedupeByExternalId<T extends { externalId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    result.push(item);
  }

  return result;
}
