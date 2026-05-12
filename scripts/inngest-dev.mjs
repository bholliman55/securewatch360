import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const appUrl = process.env.INNGEST_APP_URL?.trim() || "http://localhost:3000/api/inngest";

/**
 * Wait for Next.js to be ready before starting Inngest, so the initial sync
 * succeeds and functions are registered on first attempt.
 * Without this, concurrently starts both at once and Inngest's auto-discovery
 * fires before /api/inngest exists, registering 0 functions.
 */
async function waitForNextJs(url, maxWaitMs = 60_000) {
  const deadline = Date.now() + maxWaitMs;
  const checkUrl = url.replace("/api/inngest", "/api/health").replace("/api/inngest", "/");
  // Just check the root of the Next.js server
  const baseUrl = new URL(url).origin;
  console.log(`[inngest-dev] Waiting for Next.js at ${baseUrl} ...`);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
      if (res.status < 600) {
        console.log(`[inngest-dev] Next.js is up (${res.status}). Starting Inngest dev server.`);
        return;
      }
    } catch {
      // not ready yet
    }
    await sleep(1500);
  }
  console.warn("[inngest-dev] Next.js did not start within timeout — starting Inngest anyway.");
}

await waitForNextJs(appUrl);

const args = ["--ignore-scripts=false", "inngest-cli@latest", "dev", "-u", appUrl];

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
