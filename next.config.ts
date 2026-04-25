import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin tracing to this package when other lockfiles exist on the machine.
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
