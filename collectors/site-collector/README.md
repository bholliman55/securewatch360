# SecureWatch360 Local Site Collector

A local host-inventory agent that collects hardware, software, network, and process data from a single machine and exposes the result to the SecureWatch360 dev dashboard.

## What it collects

| Category | Details |
|---|---|
| Host & OS | hostname, platform, OS release, architecture, uptime |
| CPU | model, core count, speed |
| Memory | total / free / used |
| Disk | per-drive capacity and free space |
| Network interfaces | interface name, addresses, MAC |
| Installed software | display name, version, publisher (Windows; best-effort) |
| Running processes | name, PID, CPU%, memory (top 20 by memory) |
| Listening ports | port, protocol, process (Windows; best-effort) |

Output is a single JSON file at `output/latest-inventory.json`.  The collector is resilient — if one section fails the others still complete.

## Quick start

```powershell
cd collectors/site-collector
npm install
npm run dev          # collects once; writes output/latest-inventory.json
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run collector once (via `tsx`) |
| `npm run collect` | Alias for `npm run dev` |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start` | Run compiled collector |
| `npm run test` | Run unit tests (Vitest) |

### Windows helper scripts

`scripts/install-local.ps1` — installs dependencies; `scripts/run-local.ps1` — runs the collector without a terminal staying open.

## Dev dashboard integration

When the Next.js dev server is running (`npm run dev` in the repo root), the collector output is accessible at:

```
GET /api/collector/local        → returns latest-inventory.json (dev only)
GET /collector/local            → LocalCollectorDashboard UI page (dev only)
```

The API route (`src/app/api/collector/local/route.ts`) reads `collectors/site-collector/output/latest-inventory.json` from the filesystem and returns it as JSON.  Both endpoints return **404 in production** — they are development utilities only.

**Workflow:**
1. Run the collector: `cd collectors/site-collector && npm run dev`
2. Start the Next.js server: `npm run dev` (repo root)
3. Visit `http://localhost:3000/collector/local` to view the inventory dashboard

## Output schema

```jsonc
{
  "collectedAt": "ISO-8601",
  "host": { "hostname": "...", "platform": "...", "release": "..." },
  "cpu": { "model": "...", "cores": 8, "speed": 2.4 },
  "memory": { "total": 16000000000, "free": 8000000000, "used": 8000000000 },
  "disk": [{ "filesystem": "C:", "total": 500000000000, "free": 200000000000 }],
  "network": [{ "iface": "Ethernet", "address": "192.168.1.10", "mac": "..." }],
  "software": [{ "name": "...", "version": "...", "publisher": "..." }],
  "processes": [{ "name": "...", "pid": 1234, "cpu": 0.1, "memory": 52428800 }],
  "ports": [{ "port": 443, "protocol": "TCP", "process": "node.exe" }]
}
```

## Platform support

| OS | Asset inventory | Software discovery | Process/port summary |
|---|---|---|---|
| Windows | Full | Best-effort (registry) | Best-effort (`netstat`, `tasklist`) |
| Linux | Partial | Stubbed | Stubbed |
| macOS | Partial | Stubbed | Stubbed |

Linux/macOS stubs exist in `src/softwareInventory.ts` for future extension.

## Integration roadmap

This is an MVP collector.  Planned expansions (not yet implemented):

- **Agent registration** — POST inventory to `/api/assets` so assets appear in the asset inventory table and become scan targets.
- **Fleet deployment** — packaging as a Windows service / systemd unit with periodic push.
- **Multi-tenant scoping** — associate collected inventory with a `tenantId` and `clientId`.
- **Delta reporting** — track software/port changes between runs and surface diffs as findings.
