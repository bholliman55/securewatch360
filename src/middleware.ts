import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Paths that are accessible without authentication.
 * Everything else requires a valid Supabase session.
 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/investor-demo",
  "/cmmc-demo",
]);

/**
 * Supabase SSR middleware.
 *
 * Responsibilities:
 * 1. Refresh the session cookie on every request so tokens never go stale.
 * 2. Redirect unauthenticated users to /login (with ?next= so they land back
 *    where they were after signing in).
 * 3. Redirect already-authenticated users away from /login and /signup.
 *
 * Security note: `getUser()` makes a round-trip to the Supabase Auth server
 * and cannot be spoofed by a tampered cookie. Never use `getSession()` in
 * middleware for access control.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured — allow through so developers see the error
    // in the app rather than an opaque redirect loop.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write cookies into the request so downstream handlers see them,
        // and into the response so the browser stores them.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() validates the JWT against Supabase Auth — cannot be forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Authenticated users visiting auth pages → send to account so they can see
  // their tenant status and navigate accordingly (no DB query needed here).
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  // Unauthenticated requests to protected paths → login with return URL.
  if (!user && !PUBLIC_PATHS.has(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - Next.js internals (_next/static, _next/image)
     * - Static assets at the root (favicon.ico, logo.png, *.svg, *.webp, *.png)
     * - /api routes (they authenticate themselves via requireTenantAccess)
     * - /console (Vite SPA — served as a static bundle)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|webp|ico)|api/|console/).*)",
  ],
};
