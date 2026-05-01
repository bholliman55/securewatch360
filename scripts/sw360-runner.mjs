#!/usr/bin/env node
/**
 * Minimal SecureWatch360 runner: posts periodic heartbeats to the app API.
 *
 * Required env:
 *   SW360_RUNNER_TOKEN      — must match server SW360_RUNNER_TOKEN
 *   SW360_RUNNER_TENANT_ID  — tenant UUID
 *
 * Optional:
 *   SW360_API_BASE          — default http://localhost:3000
 *   SW360_RUNNER_ID         — stable id for this host (default: hostname)
 *   SW360_RUNNER_INTERVAL_S — seconds between heartbeats (default 120)
 *   SW360_RUNNER_VERSION    — semver or git sha string for this binary
 */

import os from "node:os";

const base = (process.env.SW360_API_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.SW360_RUNNER_TOKEN?.trim();
const tenantId = process.env.SW360_RUNNER_TENANT_ID?.trim();
const runnerId =
  process.env.SW360_RUNNER_ID?.trim() ||
  os.hostname();
const intervalSec = Math.max(30, Number(process.env.SW360_RUNNER_INTERVAL_S ?? "120") || 120);
const version = process.env.SW360_RUNNER_VERSION?.trim() || "0.0.0-dev";

if (!token || !tenantId) {
  console.error("SW360_RUNNER_TOKEN and SW360_RUNNER_TENANT_ID are required.");
  process.exit(1);
}

async function beat() {
  const res = await fetch(`${base}/api/runner/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tenantId,
      runnerId,
      version,
      hostName: os.hostname(),
      capabilities: ["heartbeat", "telemetry-v1"],
      metadata: { pid: process.pid, node: process.version, platform: process.platform },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[sw360-runner] ${res.status} ${text}`);
    return;
  }
  console.log(`[sw360-runner] ok ${new Date().toISOString()}`);
}

await beat();
setInterval(beat, intervalSec * 1000);
