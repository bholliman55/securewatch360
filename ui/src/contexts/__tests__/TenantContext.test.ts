import { describe, expect, it } from "vitest";
import { getPreferredTenantId, type TenantOption } from "../TenantContext";

describe("TenantContext helper", () => {
  it("prefers owner over lower roles", () => {
    const tenants: TenantOption[] = [
      { id: "t-analyst", name: "Acme", role: "analyst" },
      { id: "t-owner", name: "Beta", role: "owner" },
      { id: "t-admin", name: "Gamma", role: "admin" },
    ];
    expect(getPreferredTenantId(tenants)).toBe("t-owner");
  });

  it("uses alphabetical name when roles tie", () => {
    const tenants: TenantOption[] = [
      { id: "t-z", name: "Zulu", role: "admin" },
      { id: "t-a", name: "Alpha", role: "admin" },
    ];
    expect(getPreferredTenantId(tenants)).toBe("t-a");
  });

  it("returns null when no tenants exist", () => {
    expect(getPreferredTenantId([])).toBeNull();
  });
});
