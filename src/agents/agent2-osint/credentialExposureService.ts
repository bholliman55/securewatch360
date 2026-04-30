import { BrightDataAcquisitionProvider } from "@/services/data-acquisition/BrightDataAcquisitionProvider";
import type { OsintEvent } from "./osintTypes";
import { normalizeToOsintEvent } from "./osintNormalizer";

// Only collects metadata about exposure — never retrieves or stores raw passwords.
export async function collectCredentialExposure(
  domain: string,
  knownEmails: string[] = []
): Promise<OsintEvent[]> {
  const provider = new BrightDataAcquisitionProvider();
  const events: OsintEvent[] = [];

  const domainEvents = await provider.collectCredentialExposureSignals(domain);
  events.push(...domainEvents.map(normalizeToOsintEvent));

  // Wire: for each known email, query breach index APIs (e.g. HIBP API with authorization)
  // IMPORTANT: never fetch or store raw passwords — only metadata
  for (const email of knownEmails.slice(0, 10)) {
    void email; // Wire: `await checkEmailBreachStatus(email)` with HIBP or similar
  }

  return events;
}
