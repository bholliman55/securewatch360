const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(process.cwd()),
};

module.exports = nextConfig;