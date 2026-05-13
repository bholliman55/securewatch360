import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output bundles only what's needed — used by Docker image.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  // Pin tracing to this package when other lockfiles exist on the machine.
  outputFileTracingRoot: path.join(process.cwd()),
  // Inline public Supabase vars at build time so they're available in all
  // deployment targets (Cloudflare Workers, Docker, Vercel, etc.).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
};

export default nextConfig;
