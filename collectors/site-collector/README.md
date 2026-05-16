# SecureWatch360 Local Site Collector

A small local collector MVP for Windows development machines.

## What it does

- collects host, OS, CPU, memory, disk, network, software, process, and port summary
- writes a JSON report to `output/latest-inventory.json`
- continues collecting even if one section fails

## Quick start

```powershell
cd collectors/site-collector
npm install
npm run dev
```

`npm run dev` runs the collector once and writes the report to:

- `collectors/site-collector/output/latest-inventory.json`

## Scripts

- `npm run dev` — run the collector in-place using `tsx`
- `npm run build` — compile TypeScript into `dist`
- `npm run start` — run the compiled collector
- `npm run collect` — alias for `npm run dev`
- `npm run test` — run unit tests

## Windows-first support

This first MVP targets Windows and uses safe child-process commands for:

- installed software discovery
- process summary
- listening ports
- disk inventory

Linux/macOS support is intentionally placeholder-only for now.

## Limitations

- does not register with SecureWatch360 yet
- does not deploy across fleets or tenants
- software discovery is best-effort on Windows only
- process and port summaries are Windows-first
- Linux/macOS support is stubbed for future extension
