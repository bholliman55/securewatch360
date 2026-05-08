/**
 * Tiny .env.local loader for the investor-demo CLI scripts.
 *
 * The user-facing npm scripts are deliberately `tsx scripts/demo/<name>.ts`
 * (no `--env-file=` prefix). Rather than depend on `dotenv`, this helper
 * reads `.env.local` from the current working directory and copies any
 * KEY=VALUE pairs into `process.env` if they are not already set.
 *
 * Lines starting with `#`, blank lines, and entries without an `=` are
 * skipped. Quoted values are unquoted. We never overwrite an existing
 * env var, so `SUPABASE_SERVICE_ROLE_KEY=… npm run demo:seed` still wins
 * over the file.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotEnvIfMissing(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

export function requireSupabaseEnv(): void {
  loadDotEnvIfMissing();
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.error(
      `[demo] Missing required env vars: ${missing.join(", ")}. ` +
        `Add them to .env.local or export them in your shell.`,
    );
    process.exit(1);
  }
}
