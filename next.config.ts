import type { NextConfig } from "next";
import path from "node:path";

type WebpackConfig = Parameters<NonNullable<NextConfig["webpack"]>>[0];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    optimizePackageImports: ['some-large-package'],
  },
  webpack: (config: WebpackConfig, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxSize: 24 * 1024 * 1024, // 24 MiB max per chunk
      };
    }
    return config;
  },
};
export default nextConfig;
