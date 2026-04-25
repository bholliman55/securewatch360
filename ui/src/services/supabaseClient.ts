import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

/**
 * Browser client with cookie-based session so Next.js route handlers
 * (`getCurrentUser`) see the same auth as this UI when proxied on the same host.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
