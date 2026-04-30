export class BrightDataError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "BrightDataError";
  }
}

export class BrightDataAuthError extends BrightDataError {
  constructor(message = "Bright Data authentication failed") {
    super(message, "AUTH_ERROR", false, 401);
    this.name = "BrightDataAuthError";
  }
}

export class BrightDataRateLimitError extends BrightDataError {
  constructor(message = "Bright Data rate limit exceeded") {
    super(message, "RATE_LIMIT", true, 429);
    this.name = "BrightDataRateLimitError";
  }
}

export class BrightDataTimeoutError extends BrightDataError {
  constructor(url: string) {
    super(`Bright Data request timed out: ${url}`, "TIMEOUT", true);
    this.name = "BrightDataTimeoutError";
  }
}

export class BrightDataUnavailableError extends BrightDataError {
  constructor(message = "Bright Data service unavailable") {
    super(message, "UNAVAILABLE", true, 503);
    this.name = "BrightDataUnavailableError";
  }
}

export function classifyBrightDataError(statusCode: number, message: string): BrightDataError {
  if (statusCode === 401 || statusCode === 403) return new BrightDataAuthError(message);
  if (statusCode === 429) return new BrightDataRateLimitError(message);
  if (statusCode >= 500) return new BrightDataUnavailableError(message);
  return new BrightDataError(message, "HTTP_ERROR", statusCode >= 500, statusCode);
}
