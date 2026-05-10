import { createHmac, timingSafeEqual } from "node:crypto";

function tryHexBuf(hex: string): Buffer | null {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 === 1) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Validates `X-SW360-Signature: sha256=<hex>` or `sha256=<hex>` against the raw webhook body.
 */
export function verifyWebhookHmacSha256(args: {
  secret: string;
  rawBody: string | Buffer;
  signatureHeader: string;
}): boolean {
  const raw = typeof args.rawBody === "string" ? args.rawBody : args.rawBody.toString("utf8");
  const header = args.signatureHeader.trim();
  const m = header.match(/^sha256=([a-f0-9]+)$/i) ?? header.match(/signature=sha256=([a-f0-9]+)$/i);
  if (!m) return false;
  const expected = createHmac("sha256", args.secret).update(raw, "utf8").digest("hex");
  const a = tryHexBuf(expected);
  const b = tryHexBuf(m[1]);
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signWebhookBody(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}
