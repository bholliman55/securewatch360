# Adversarial Target Notes

## Default Safe Test Targets

- `http://testphp.vulnweb.com`
  - Public intentionally vulnerable web app target commonly used for scanner validation.
- `https://expired.badssl.com`
  - Expired TLS cert scenario.
- `https://self-signed.badssl.com`
  - Self-signed cert scenario.

## When To Override `ADVERSARIAL_TARGETS`

Use overrides when:

- You have a customer-owned staging target with written authorization.
- You want to validate a specific scanner parser edge case.
- You need tenant-specific regression verification before demo/release.

## Interpreting Common Results

- `run status stuck at running`:
  - Usually workflow timeout/queue pressure, not necessarily scanner parsing.
- `findings total = 0` on a known risky target:
  - Investigate adapter command execution and parsing regex first.
- Mixed severity only at medium/low:
  - Review severity mapping thresholds in adapters.
