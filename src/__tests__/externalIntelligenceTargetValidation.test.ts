import { describe, expect, it } from "vitest";
import {
  isBlockedExternalTarget,
  normalizeDomain,
} from "@/app/api/security/external-intelligence/run/route";

describe("external intelligence target validation", () => {
  it("normalizes hostname from full URL", () => {
    expect(normalizeDomain("https://app.example-security.com/login")).toBe(
      "app.example-security.com"
    );
  });

  it("allows public IPv4 targets", () => {
    expect(isBlockedExternalTarget("8.8.8.8")).toBe(false);
  });

  it("blocks localhost and private domains", () => {
    expect(isBlockedExternalTarget("localhost")).toBe(true);
    expect(isBlockedExternalTarget("demo.internal")).toBe(true);
  });

  it("blocks RFC1918 and loopback IPv4 ranges", () => {
    expect(isBlockedExternalTarget("10.1.2.3")).toBe(true);
    expect(isBlockedExternalTarget("172.16.4.20")).toBe(true);
    expect(isBlockedExternalTarget("192.168.1.2")).toBe(true);
    expect(isBlockedExternalTarget("127.0.0.1")).toBe(true);
  });
});
