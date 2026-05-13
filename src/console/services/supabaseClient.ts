/**
 * Re-exports the shared Next.js browser Supabase client so all console
 * components use the same singleton — same cookie-based session, no duplicate
 * initialization, and no separate env var configuration.
 */
export { getSupabaseBrowserClient as getClient } from "@/lib/supabase";

import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Deferred singleton — initialised on first access rather than at module load.
// Prevents "Missing NEXT_PUBLIC_SUPABASE_URL" throws when the env var is not
// yet baked into the bundle (e.g. dev server started before .env.local existed).
let _client: ReturnType<typeof getSupabaseBrowserClient> | null = null;

function getClient_(): ReturnType<typeof getSupabaseBrowserClient> {
  if (!_client) _client = getSupabaseBrowserClient();
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient_();
    if (!c) return undefined;
    const val = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(c) : val;
  },
}) as ReturnType<typeof getSupabaseBrowserClient>;
