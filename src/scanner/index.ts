import type {
  ScanContext,
  ScannerAdapter,
  ScannerAdapterId,
  ScannerRunResult,
} from "./adapters";
import { nmapScannerAdapter } from "./adapters/nmap";
import { osvScannerAdapter } from "./adapters/osv";
import { trivyScannerAdapter } from "./adapters/trivy";
import { zapScannerAdapter } from "./adapters/zap";
import { mockScannerAdapter } from "./mockScanner";
import { getRecommendedScannersForTargetType } from "./selectionRules";

const scannerRegistry: Record<ScannerAdapterId, ScannerAdapter> = {
  mock: mockScannerAdapter,
  nmap: nmapScannerAdapter,
  zap: zapScannerAdapter,
  trivy: trivyScannerAdapter,
  osv: osvScannerAdapter,
};

type RunScanInput = ScanContext & {
  scannerId?: ScannerAdapterId;
};

/**
 * Direct scanner runner by scanner ID.
 */
export async function runScan(input: RunScanInput): Promise<ScannerRunResult> {
  const chosenId = input.scannerId ?? "mock";
  const scanner = scannerRegistry[chosenId];
  if (!scanner) {
    throw new Error(`Scanner '${chosenId}' is not registered`);
  }

  if (!scanner.metadata.implemented) {
    throw new Error(`Scanner '${chosenId}' exists but is not implemented yet`);
  }

  return scanner.run(input);
}

/**
 * Generic scanner entrypoint for workflow usage.
 * Scanner is selected from target_type and falls back to `mock` in v1.
 */
export async function runScanForTarget(input: ScanContext): Promise<ScannerRunResult> {
  const recommended = getRecommendedScannersForTargetType(input.targetType);
  const failures: Array<{ scannerId: ScannerAdapterId; error: string }> = [];

  for (const scannerId of recommended) {
    const scanner = scannerRegistry[scannerId];
    if (scanner && scanner.metadata.implemented) {
      try {
        return await scanner.run(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ scannerId, error: message });
      }
    }
  }

  // Final safety net for v1.
  const fallbackResult = await scannerRegistry.mock.run(input);
  if (failures.length > 0 && fallbackResult.findings[0]) {
    fallbackResult.findings[0].evidence = {
      ...fallbackResult.findings[0].evidence,
      realScannerFailures: failures,
    };
  }
  return fallbackResult;
}

export function listScanners(): ScannerAdapter[] {
  return Object.values(scannerRegistry);
}
