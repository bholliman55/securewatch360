import { describe, it, expect } from "vitest";
import { minimalSyntheticFindingScenario } from "../fixtures/minimalSyntheticFinding.fixture";

describe("Simulation lab foundation", () => {
  it("exposes a minimal harmless scenario fixture", () => {
    expect(minimalSyntheticFindingScenario.id).toBe("lab-find-001");
    expect(minimalSyntheticFindingScenario.assurance).toBe("synthetic_metadata_only");
    expect(minimalSyntheticFindingScenario.eventTemplates).toHaveLength(1);
  });
});
