/**
 * Re-exports the shared Next.js browser Supabase client so all console
 * components use the same singleton — same cookie-based session, no duplicate
 * initialization, and no separate env var configuration.
 */
export { getSupabaseBrowserClient as getClient } from "@/lib/supabase";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export const supabase = getSupabaseBrowserClient();
