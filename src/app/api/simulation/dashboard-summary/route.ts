/**
 * Latest (or keyed) persisted simulation structured report exposes `dashboard_summary` for the SecureWatch360 console.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function resolveSimulationResultsDir(): string {
  const fromEnv = process.env.SIMULATION_RESULTS_DIR?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
  return path.join(process.cwd(), ".simulation-results");
}

function summaryFromReportJson(raw: Record<string, unknown>): unknown | null {
  const ds =
    raw.dashboard_summary ??
    (typeof raw.dashboardSummary === "object" && raw.dashboardSummary !== null
      ? raw.dashboardSummary
      : null);

  return ds ?? null;
}

/** GET — ?runId=<uuid> for a specific persisted run, otherwise newest *-simulation-report.json by mtime. */
export async function GET(req: NextRequest) {
  try {
    const dir = resolveSimulationResultsDir();
    const runId = req.nextUrl.searchParams.get("runId")?.trim();

    if (runId) {
      const filePath = path.join(dir, `${runId}-simulation-report.json`);
      const rawText = await fs.readFile(filePath, "utf8").catch(() => null);
      if (!rawText) {
        return NextResponse.json({ error: "Simulation report not found for runId.", runId }, { status: 404 });
      }
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      const summary = summaryFromReportJson(parsed);
      if (!summary) {
        return NextResponse.json(
          { error: "Report JSON missing dashboard_summary (re-run simulator with latest tooling).", runId },
          { status: 422 },
        );
      }
      return NextResponse.json({ summary, source: path.basename(filePath) });
    }

    const names = await fs.readdir(dir).catch(() => [] as string[]);
    const reportFiles = names.filter((n) => n.endsWith("-simulation-report.json"));
    if (reportFiles.length === 0) {
      return NextResponse.json(
        { error: "No simulation reports yet. Run: npm run sim:run — then refresh." },
        { status: 404 },
      );
    }

    let best: { name: string; mtimeMs: number } | undefined;
    for (const name of reportFiles) {
      const fp = path.join(dir, name);
      const stat = await fs.stat(fp).catch(() => null);
      if (!stat?.isFile()) continue;
      if (!best || stat.mtimeMs > best.mtimeMs) best = { name, mtimeMs: stat.mtimeMs };
    }
    if (!best) {
      return NextResponse.json({ error: "Could not stat simulation reports." }, { status: 500 });
    }

    const filePath = path.join(dir, best.name);
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
    const summary = summaryFromReportJson(parsed);
    if (!summary) {
      return NextResponse.json(
        { error: "Latest simulation report lacks dashboard_summary. Re-run the simulator." },
        { status: 422 },
      );
    }

    return NextResponse.json({ summary, source: best.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
