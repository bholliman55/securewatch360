import { describe, it, expect } from "vitest";
import {
  isBlockedExternalTarget,
  isPrivateCgnatOrReservedIpv4,
  parseIpv4Octets,
} from "@/lib/externalTargetSafety";

describe("externalTargetSafety", () => {
  describe("isPrivateCgnatOrReservedIpv4", () => {
    it("flags RFC 6598 CGNAT 100.64.0.0/10", () => {
      const o = parseIpv4Octets("100.64.0.1");
      expect(o).not.toBeNull();
      expect(isPrivateCgnatOrReservedIpv4(o!)).toBe(true);
      expect(isPrivateCgnatOrReservedIpv4(parseIpv4Octets("100.127.255.255")!)).toBe(true);
    });

    it("does not flag adjacent public space below CGNAT", () => {
      expect(isPrivateCgnatOrReservedIpv4(parseIpv4Octets("100.63.255.255")!)).toBe(false);
    });

    it("does not flag public space above CGNAT", () => {
      expect(isPrivateCgnatOrReservedIpv4(parseIpv4Octets("100.128.0.1")!)).toBe(false);
    });
  });

  describe("isBlockedExternalTarget", () => {
    it("blocks IPv4-mapped IPv6 private addresses (SSRF bypass)", () => {
      expect(isBlockedExternalTarget("::ffff:10.0.0.1")).toBe(true);
      expect(isBlockedExternalTarget("::FFFF:192.168.1.1")).toBe(true);
      expect(isBlockedExternalTarget("::ffff:100.64.0.5")).toBe(true);
    });

    it("blocks IPv4-mapped public addresses (parity with bare IPv4 literals)", () => {
      expect(isBlockedExternalTarget("::ffff:8.8.8.8")).toBe(true);
    });

    it("allows normal public domains", () => {
      expect(isBlockedExternalTarget("example.com")).toBe(false);
      expect(isBlockedExternalTarget("vendor.example.org")).toBe(false);
    });

    it("blocks reserved hostnames", () => {
      expect(isBlockedExternalTarget("localhost")).toBe(true);
      expect(isBlockedExternalTarget("app.internal")).toBe(true);
    });

    it("blocks bare IPv4 literals", () => {
      expect(isBlockedExternalTarget("10.0.0.1")).toBe(true);
      expect(isBlockedExternalTarget("8.8.8.8")).toBe(true);
    });

    it("blocks IPv6 loopback and ULA", () => {
      expect(isBlockedExternalTarget("::1")).toBe(true);
      expect(isBlockedExternalTarget("fd00::1")).toBe(true);
    });
  });
});
