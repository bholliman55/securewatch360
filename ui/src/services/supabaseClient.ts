import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createDemoSupabaseClient() {
  const unsupported = new Error(
    "Supabase is not configured for this UI build. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
  return {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {
                return undefined;
              },
            },
          },
        };
      },
      async signInWithPassword() {
        return { data: null, error: unsupported };
      },
      async signUp() {
        return { data: null, error: unsupported };
      },
      async signOut() {
        return { error: null };
      },
      async resetPasswordForEmail() {
        return { data: null, error: unsupported };
      },
    },
  };
}

/**
 * Browser client with cookie-based session so Next.js route handlers
 * (`getCurrentUser`) see the same auth as this UI when proxied on the same host.
 */
export const supabase: any =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createDemoSupabaseClient();
