import { BrightDataAcquisitionProvider } from "@/services/data-acquisition/BrightDataAcquisitionProvider";
import type { DataAcquisitionProvider } from "@/services/data-acquisition/DataAcquisitionProvider";
import { collectCredentialExposure } from "./credentialExposureService";
import { rescore } from "./threatSignalScoring";
import { normalizeToOsintEvent, buildSeverityBreakdown } from "./osintNormalizer";
import type { OsintCollectionInput, OsintCollectionResult } from "./osintTypes";

export async function runOsintCollection(
  input: OsintCollectionInput,
  provider: DataAcquisitionProvider = new BrightDataAcquisitionProvider()
): Promise<OsintCollectionResult> {
  const errors: string[] = [];
  const allEvents = [];

  // Credential exposure — metadata only, no raw passwords
  try {
    const credEvents = await collectCredentialExposure(input.domain, input.knownEmails);
    allEvents.push(...credEvents);
  } catch (err) {
    errors.push(`Credential exposure collection failed: ${(err as Error).message}`);
  }

  // OSINT signals (breach refs, exploit chatter, vuln mentions)
  try {
    const osintEvents = await provider.collectOsintSignals({
      domain: input.domain,
      companyName: input.companyName,
      knownEmails: input.knownEmails,
      clientId: input.clientId,
      scanId: input.scanId,
    });
    allEvents.push(...osintEvents.map(normalizeToOsintEvent));
  } catch (err) {
    errors.push(`OSINT signal collection failed: ${(err as Error).message}`);
  }

  // Apply consistent threat scoring across all events
  const scored = rescore(allEvents);

  return {
    domain: input.domain,
    totalEvents: scored.length,
    dedupeCount: allEvents.length - scored.length,
    severityBreakdown: buildSeverityBreakdown(scored),
    events: scored,
    errors,
    completedAt: new Date(),
  };
}
