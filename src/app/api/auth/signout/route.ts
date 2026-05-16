import { NextResponse } from "next/server";
import { getSupabaseServerAuthClient } from "@/lib/auth";

export async function POST(request: Request) {
  const supabase = await getSupabaseServerAuthClient();
  await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/login`, { status: 302 });

  // Belt-and-suspenders: manually expire the Supabase auth cookies so the
  // redirect lands on a clean, unauthenticated /login page.
  for (const name of [
    "sb-access-token",
    "sb-refresh-token",
    `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`,
  ]) {
    if (name) response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}
