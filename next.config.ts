import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output bundles only what's needed — used by Docker image.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  // Pin tracing to this package when other lockfiles exist on the machine.
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
