import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output bundles only what's needed — used by Docker image.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  // Pin tracing to this package when other lockfiles exist on the machine.
  outputFileTracingRoot: path.join(process.cwd()),
  // Explicitly expose public vars so they're inlined even when the Cloudflare
  // dev adapter is active (which can interfere with NEXT_PUBLIC_* replacement).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
};

export default nextConfig;

// Only activate the Cloudflare dev adapter when explicitly opted in (e.g.
// CF_DEV=1 npm run dev).  The adapter proxies every request through a
// Workers-like runtime and causes the browser to hang in plain Next.js dev.
if (process.env.CF_DEV === "1") {
  import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
}
