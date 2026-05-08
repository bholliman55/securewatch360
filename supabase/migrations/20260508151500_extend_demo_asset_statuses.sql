-- SecureWatch360: extend demo_assets.status vocabulary for the investor
-- replay engine.
--
-- The replay engine in src/demo/investorMode/demoReplayEngine.ts walks
-- LAPTOP-123 through a multi-stage compromise → containment narrative and
-- needs intermediate, simulation-only statuses that the original migration
-- (`20260508145000_create_investor_demo_tables.sql`) does not allow:
--
--   - 'suspicious'              (3s mark — anomalous PowerShell observed)
--   - 'compromised_simulated'   (9s mark — credential access seen)
--   - 'isolated_simulated'      (33s mark — endpoint isolation simulated)
--
-- The `_simulated` suffix is intentional: we never want a real operator
-- staring at a SOC dashboard to mistake a demo asset for a live compromised
-- machine. These statuses are *only* set by the demo replay engine.

alter table public.demo_assets
  drop constraint if exists demo_assets_status_check;

alter table public.demo_assets
  add constraint demo_assets_status_check check (
    status in (
      'healthy',
      'suspicious',
      'at_risk',
      'compromised',
      'compromised_simulated',
      'isolated',
      'isolated_simulated',
      'remediated'
    )
  );

comment on constraint demo_assets_status_check on public.demo_assets is
  'Status vocabulary for synthetic demo assets. _simulated suffix denotes states only set by the replay engine — never by real telemetry.';
