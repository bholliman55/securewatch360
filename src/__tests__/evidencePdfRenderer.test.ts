import { describe, it, expect } from "vitest";
import { renderEvidenceHtml } from "@/lib/evidencePdfRenderer";
import type { EvidencePackage } from "@/lib/evidencePackager";

function makePackage(overrides: Partial<EvidencePackage> = {}): EvidencePackage {
  return {
    framework: "nist",
    generatedAt: "2026-04-30T12:00:00.000Z",
    tenantId: "tenant-test",
    summary: { totalControls: 3, passing: 2, failing: 1, notApplicable: 0, evidenceCount: 5 },
    controls: [
      { controlId: "PR.DS-01", controlName: "Data-at-Rest Protection", status: "passing", findingCount: 0 },
      { controlId: "ID.AM-01", controlName: "Asset Inventory", status: "failing", findingCount: 2 },
    ],
    findings: [
      { id: "f-1", title: "Unencrypted S3 Bucket", severity: "critical", status: "open" },
      { id: "f-2", title: "Stale IAM Key", severity: "high", status: "open" },
    ],
    auditLog: [
      { created_at: "2026-04-29T10:00:00.000Z", action: "finding.created", resource_type: "finding", actor_user_id: "user-abc123" },
    ],
    ...overrides,
  };
}

describe("renderEvidenceHtml", () => {
  it("returns a valid HTML document", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes framework name", () => {
    const html = renderEvidenceHtml(makePackage({ framework: "hipaa" }));
    expect(html.toLowerCase()).toContain("hipaa");
  });

  it("includes summary stats", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("3"); // totalControls
    expect(html).toContain("2"); // passing
    expect(html).toContain("1"); // failing
  });

  it("includes control rows", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("PR.DS-01");
    expect(html).toContain("Data-at-Rest Protection");
    expect(html).toContain("ID.AM-01");
  });

  it("renders status badges for passing and failing", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("passing");
    expect(html).toContain("failing");
    // Green badge for passing
    expect(html).toContain("#166534");
    // Red badge for failing
    expect(html).toContain("#991b1b");
  });

  it("includes finding rows with severity badges", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("Unencrypted S3 Bucket");
    expect(html).toContain("Stale IAM Key");
    expect(html).toContain("critical");
    expect(html).toContain("high");
  });

  it("limits findings to 50 rows", () => {
    const manyFindings = Array.from({ length: 100 }, (_, i) => ({
      id: `f-${i}`,
      title: `Finding ${i}`,
      severity: "low",
      status: "open",
    }));
    const html = renderEvidenceHtml(makePackage({ findings: manyFindings }));
    const matchCount = (html.match(/Finding \d+/g) ?? []).length;
    expect(matchCount).toBeLessThanOrEqual(50);
  });

  it("escapes HTML in user-supplied strings", () => {
    const xssFinding = [{ id: "f-xss", title: "<script>alert(1)</script>", severity: "high", status: "open" }];
    const html = renderEvidenceHtml(makePackage({ findings: xssFinding }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes HTML in control names", () => {
    const controls = [{ controlId: "X.01", controlName: '<img src=x onerror="evil()">', status: "passing" as const, findingCount: 0 }];
    const html = renderEvidenceHtml(makePackage({ controls }));
    expect(html).not.toContain('<img src=x onerror="evil()">');
    expect(html).toContain("&lt;img");
  });

  it("includes audit log rows", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("finding.created");
    expect(html).toContain("finding");
  });

  it("truncates actor_user_id in audit log", () => {
    const html = renderEvidenceHtml(makePackage());
    // Should show first 8 chars + ellipsis
    expect(html).toContain("user-abc");
    expect(html).toContain("…");
  });

  it("formats audit log timestamp (strips milliseconds)", () => {
    const html = renderEvidenceHtml(makePackage());
    expect(html).toContain("2026-04-29 10:00:00");
  });

  it("handles empty arrays gracefully", () => {
    const html = renderEvidenceHtml(makePackage({ controls: [], findings: [], auditLog: [] }));
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });
});
