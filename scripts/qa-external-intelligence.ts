/**
 * QA script for the Bright Data external intelligence build.
 *
 * Usage:
 *   npm run qa:external-intel -- example.com
 *   npm run qa:external-intel -- example.com --persist
 */
import { runExternalDiscoveryScan } from "../src/agents/agent1-scanner/externalDiscoveryService";
import { runOsintCollection } from "../src/agents/agent2-osint/osintCollectionService";
import { upsertExternalAssets } from "../src/repositories/externalAssetsRepository";
import { upsertIntelligenceEvents } from "../src/repositories/externalIntelligenceRepository";
import { randomUUID } from "crypto";

const args = process.argv.slice(2);
const domain = args.find((a) => !a.startsWith("--"));
const persist = args.includes("--persist");

if (!domain) {
  console.error("Usage: npm run qa:external-intel -- <domain> [--persist]");
  process.exit(1);
}

const PASS = "\x1b[32m✔\x1b[0m";
const FAIL = "\x1b[31m✖\x1b[0m";
const INFO = "\x1b[36mℹ\x1b[0m";

function sep() { console.log("─".repeat(60)); }

async function main() {
  console.log(`\n${INFO}  SecureWatch360 External Intelligence QA`);
  console.log(`${INFO}  Domain: ${domain}`);
  console.log(`${INFO}  Persist: ${persist}`);
  sep();

  const scanId = randomUUID();
  let allPassed = true;

  // ── Agent 1: External Discovery ──────────────────────────────
  console.log("\n[Agent 1] External Attack Surface Discovery");
  let agent1Result;
  try {
    agent1Result = await runExternalDiscoveryScan({
      scanId,
      domain: domain!,
      includeSubdomains: true,
      includeCertificates: true,
      includePublicEndpoints: true,
    });

    console.log(`  ${PASS} Scan completed`);
    console.log(`  ${INFO}  Total assets:  ${agent1Result.totalDiscovered}`);
    console.log(`  ${INFO}  Dedupe count:  ${agent1Result.dedupeCount}`);

    const byType: Record<string, number> = {};
    for (const a of agent1Result.assets) {
      byType[a.assetType] = (byType[a.assetType] ?? 0) + 1;
    }
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${INFO}  ${type.padEnd(30)} ${count}`);
    }

    if (agent1Result.errors.length > 0) {
      for (const e of agent1Result.errors) console.log(`  ${FAIL} Provider error: ${e}`);
      allPassed = false;
    }
  } catch (err) {
    console.log(`  ${FAIL} Agent 1 threw: ${(err as Error).message}`);
    allPassed = false;
    agent1Result = null;
  }

  // ── Agent 2: OSINT Collection ────────────────────────────────
  sep();
  console.log("\n[Agent 2] OSINT & Threat Intelligence Collection");
  let agent2Result;
  try {
    agent2Result = await runOsintCollection({ domain: domain!, scanId });

    console.log(`  ${PASS} Collection completed`);
    console.log(`  ${INFO}  Total events:  ${agent2Result.totalEvents}`);
    console.log(`  ${INFO}  Dedupe count:  ${agent2Result.dedupeCount}`);
    console.log(`  ${INFO}  Severity breakdown:`);
    for (const [sev, count] of Object.entries(agent2Result.severityBreakdown)) {
      console.log(`    ${INFO}  ${sev.padEnd(10)} ${count}`);
    }

    if (agent2Result.errors.length > 0) {
      for (const e of agent2Result.errors) console.log(`  ${FAIL} Provider error: ${e}`);
      allPassed = false;
    }
  } catch (err) {
    console.log(`  ${FAIL} Agent 2 threw: ${(err as Error).message}`);
    allPassed = false;
    agent2Result = null;
  }

  // ── Persist (optional) ───────────────────────────────────────
  if (persist) {
    sep();
    console.log("\n[Persist] Writing results to Supabase");
    if (agent1Result?.assets.length) {
      try {
        await upsertExternalAssets(agent1Result.assets);
        console.log(`  ${PASS} External assets persisted (${agent1Result.assets.length})`);
      } catch (err) {
        console.log(`  ${FAIL} Assets persist failed: ${(err as Error).message}`);
        allPassed = false;
      }
    }
    if (agent2Result?.events.length) {
      try {
        await upsertIntelligenceEvents(agent2Result.events);
        console.log(`  ${PASS} Intelligence events persisted (${agent2Result.events.length})`);
      } catch (err) {
        console.log(`  ${FAIL} Events persist failed: ${(err as Error).message}`);
        allPassed = false;
      }
    }
  }

  // ── Result ───────────────────────────────────────────────────
  sep();
  if (allPassed) {
    console.log(`\n${PASS}  All checks passed\n`);
    process.exit(0);
  } else {
    console.log(`\n${FAIL}  Some checks failed — review errors above\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(FAIL, "Unexpected error:", err);
  process.exit(1);
});
