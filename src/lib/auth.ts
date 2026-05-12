import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

function getAuthEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anonKey };
}

/**
 * Server-side Supabase auth client tied to request cookies.
 * This is the starter foundation for session-aware server rendering.
 */
export async function getSupabaseServerAuthClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getAuthEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // In some server-render contexts cookies are read-only; ignore.
        }
      },
    },
  });
}

/**
 * Simple helper for server components/routes that need current auth context.
 */
export async function getCurrentUser(): Promise<User | null> {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;

  if (bearerToken) {
    const supabase = await getSupabaseServerAuthClient();
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (!error && data.user) {
      return data.user;
    }
  }

  const supabase = await getSupabaseServerAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
