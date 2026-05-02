import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

// --- shared env (fail fast in dev when misconfigured) -----------------------------------------

function getPublicUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key;
}

// --- browser: anon key only, RLS applies ------------------------------------------------------

let browserClient: SupabaseBrowserClient | undefined;

/**
 * For Client Components in the browser. Never use the service role here.
 */
export function getSupabaseBrowserClient(): SupabaseBrowserClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(getPublicUrl(), getAnonKey());
  return browserClient;
}

// --- server / admin: service role, no user session ---------------------------------------------

const adminAuthOptions = {
  /** Do not store a user session in memory for this client. */
  persistSession: false as const,
  /** Admin client does not refresh tokens; there is no end-user session. */
  autoRefreshToken: false as const,
  /** Do not read auth params from the URL (e.g. OAuth callbacks) on this client. */
  detectSessionInUrl: false as const,
};

/**
 * For trusted server-only code: Route Handlers, Server Actions, Inngest, cron, etc.
 * Uses the service role key; bypasses RLS unless you set policies to restrict the role.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseAdminClient() must only be called on the server");
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(getPublicUrl(), key, {
    auth: adminAuthOptions,
  });
}
