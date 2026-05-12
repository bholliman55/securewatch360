import type { EvidencePackage } from "./evidencePackager";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    passing: "background:#dcfce7;color:#166534",
    failing: "background:#fee2e2;color:#991b1b",
    not_applicable: "background:#f3f4f6;color:#6b7280",
  };
  const style = colors[status] ?? colors.not_applicable;
  return `<span style="padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;${style}">${escapeHtml(status)}</span>`;
}

function severityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "background:#fee2e2;color:#991b1b",
    high: "background:#ffedd5;color:#9a3412",
    medium: "background:#fef9c3;color:#854d0e",
    low: "background:#dbeafe;color:#1e40af",
  };
  const style = colors[severity.toLowerCase()] ?? "background:#f3f4f6;color:#6b7280";
  return `<span style="padding:2px 6px;border-radius:4px;font-size:11px;${style}">${escapeHtml(severity)}</span>`;
}

export function renderEvidenceHtml(pkg: EvidencePackage): string {
  const { framework, generatedAt, tenantId, summary, controls, findings, auditLog } = pkg;

  const controlRows = controls.map((c) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${escapeHtml(c.controlId)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${escapeHtml(c.controlName)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${statusBadge(c.status)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center">${c.findingCount}</td>
    </tr>`).join("");

  const findingRows = (findings as Record<string, unknown>[]).slice(0, 50).map((f) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(String(f.id ?? ""))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${escapeHtml(String(f.title ?? ""))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${severityBadge(String(f.severity ?? ""))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(String(f.status ?? ""))}</td>
    </tr>`).join("");

  const auditRows = (auditLog as Record<string, unknown>[]).slice(0, 50).map((a) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(String(a.created_at ?? "").replace("T", " ").split(".")[0])}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${escapeHtml(String(a.action ?? ""))}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(String(a.resource_type ?? ""))}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${escapeHtml(String(a.actor_user_id ?? "").slice(0, 8))}…</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Evidence Package — ${escapeHtml(framework)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;margin:0;padding:32px;background:#fff}
  h1{font-size:22px;font-weight:700;margin:0 0 4px}
  h2{font-size:16px;font-weight:600;margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
  .meta{font-size:12px;color:#6b7280;margin-bottom:24px}
  .summary{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
  .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center}
  .stat-value{font-size:24px;font-weight:700}
  .stat-label{font-size:11px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{background:#f9fafb;padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb}
  @media print{body{padding:16px}.stat{break-inside:avoid}}
</style>
</head>
<body>
<h1>SecureWatch360 — Compliance Evidence Package</h1>
<div class="meta">
  Framework: <strong>${escapeHtml(framework)}</strong> &nbsp;|&nbsp;
  Tenant: <strong>${escapeHtml(tenantId)}</strong> &nbsp;|&nbsp;
  Generated: <strong>${new Date(generatedAt).toLocaleString()}</strong>
</div>

<h2>Executive Summary</h2>
<div class="summary">
  <div class="stat"><div class="stat-value">${summary.totalControls}</div><div class="stat-label">Total Controls</div></div>
  <div class="stat" style="border-color:#86efac"><div class="stat-value" style="color:#166534">${summary.passing}</div><div class="stat-label">Passing</div></div>
  <div class="stat" style="border-color:#fca5a5"><div class="stat-value" style="color:#991b1b">${summary.failing}</div><div class="stat-label">Failing</div></div>
  <div class="stat"><div class="stat-value">${summary.notApplicable}</div><div class="stat-label">N/A</div></div>
  <div class="stat" style="border-color:#93c5fd"><div class="stat-value" style="color:#1e40af">${summary.evidenceCount}</div><div class="stat-label">Evidence Records (90d)</div></div>
</div>

<h2>Control Status</h2>
${controls.length > 0 ? `
<table>
  <thead><tr><th>Control ID</th><th>Control Name</th><th>Status</th><th style="text-align:center">Findings</th></tr></thead>
  <tbody>${controlRows}</tbody>
</table>` : "<p style='color:#6b7280;font-size:13px'>No control data available.</p>"}

<h2>Findings (latest 50)</h2>
${findings.length > 0 ? `
<table>
  <thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
  <tbody>${findingRows}</tbody>
</table>` : "<p style='color:#6b7280;font-size:13px'>No findings in scope.</p>"}

<h2>Audit Log (latest 50 of ${auditLog.length} entries, 90d window)</h2>
${auditLog.length > 0 ? `
<table>
  <thead><tr><th>Timestamp</th><th>Action</th><th>Resource Type</th><th>Actor</th></tr></thead>
  <tbody>${auditRows}</tbody>
</table>` : "<p style='color:#6b7280;font-size:13px'>No audit log entries.</p>"}

<div style="margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
  Generated by SecureWatch360 &nbsp;·&nbsp; ${new Date(generatedAt).toUTCString()} UTC &nbsp;·&nbsp; Confidential
</div>
</body>
</html>`;
}
