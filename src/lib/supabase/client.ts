import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browser: SupabaseClient | undefined;

/**
 * Use in Client Components, browser-only. Uses the anon key (RLS applies).
 */
export function getSupabaseBrowserClient() {
  if (browser) return browser;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browser = createBrowserClient(url, anon);
  return browser;
}
