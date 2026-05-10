import { randomUUID } from "node:crypto";
import type { IdentityFinding, IdentitySignalType, NormalizedIdentityEvent } from "./types";

const SEVERITY_WEIGHT: Record<IdentityFinding["severity"], number> = {
  low: 8,
  medium: 18,
  high: 35,
  critical: 55,
};

function finding(
  tenant_id: string,
  signal_type: IdentitySignalType,
  severity: IdentityFinding["severity"],
  confidence: number,
  title: string,
  description: string,
  principal: string | undefined,
  eventIds: string[],
  remediation: string,
): IdentityFinding {
  const required_approval: IdentityFinding["required_approval"] =
    severity === "critical"
      ? "security_admin"
      : severity === "high"
        ? "analyst"
        : "none";

  return {
    id: randomUUID(),
    tenant_id,
    signal_type,
    severity,
    confidence: Math.max(0, Math.min(1, confidence)),
    title,
    description,
    affected_principal: principal,
    evidence_event_ids: eventIds,
    recommended_remediation: remediation,
    required_approval,
  };
}

function byUser(events: NormalizedIdentityEvent[]): Map<string, NormalizedIdentityEvent[]> {
  const m = new Map<string, NormalizedIdentityEvent[]>();
  for (const e of events) {
    const u = e.user_principal ?? "unknown";
    if (!m.has(u)) m.set(u, []);
    m.get(u)!.push(e);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  }
  return m;
}

export function detectImpossibleTravel(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const [, userEvents] of byUser(events)) {
    for (let i = 1; i < userEvents.length; i += 1) {
      const a = userEvents[i - 1]!;
      const b = userEvents[i]!;
      const dtHours = (Date.parse(b.observed_at) - Date.parse(a.observed_at)) / 3_600_000;
      if (dtHours <= 0 || dtHours > 6) continue;
      const ca = a.geo_country?.toUpperCase();
      const cb = b.geo_country?.toUpperCase();
      if (!ca || !cb || ca === cb) continue;
      out.push(
        finding(
          b.tenant_id,
          "impossible_travel",
          dtHours < 2 ? "high" : "medium",
          0.82,
          "Possible impossible travel",
          `User appears in ${ca} then ${cb} within ${dtHours.toFixed(1)}h.`,
          b.user_principal,
          [a.event_id, b.event_id],
          "Step-up MFA, verify sessions, revoke refresh tokens if confirmed malicious.",
        ),
      );
    }
  }
  return out;
}

export function detectMfaFatigue(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const blob = `${e.event_category} ${(e.risk_hints ?? []).join(" ")}`.toLowerCase();
    if (!/mfa|push|duo|factor|otp/.test(blob)) continue;
    const u = e.user_principal ?? "unknown";
    counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  const out: IdentityFinding[] = [];
  for (const [u, n] of counts) {
    if (n >= 8) {
      out.push(
        finding(
          events[0]!.tenant_id,
          "mfa_fatigue",
          n >= 15 ? "high" : "medium",
          0.7,
          "MFA fatigue pattern",
          `Principal ${u} shows ${n} MFA-related events in the analyzed window.`,
          u === "unknown" ? undefined : u,
          events.filter((e) => (e.user_principal ?? "unknown") === u).map((e) => e.event_id),
          "Review MFA method mix, risk-based policies, and passwordless adoption roadmap.",
        ),
      );
    }
  }
  return out;
}

export function detectRiskySignIns(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const e of events) {
    const risky =
      e.outcome?.toLowerCase().includes("fail") ||
      e.outcome === "failure" ||
      (e.mfa_required === true && e.mfa_satisfied === false) ||
      (e.roles?.some((r) => /admin|global/i.test(r)) && e.mfa_satisfied === false);
    if (risky) {
      out.push(
        finding(
          e.tenant_id,
          "risky_sign_in",
          /admin|global/i.test((e.roles ?? []).join(" ")) ? "high" : "medium",
          0.74,
          "Risky sign-in characteristics",
          `Sign-in risk indicators for ${e.user_principal ?? "unknown principal"} (${e.event_category}).`,
          e.user_principal,
          [e.event_id],
          "Force password reset, invalidate sessions, require compliant device if policy allows.",
        ),
      );
    }
  }
  return out;
}

export function detectDormantAdmin(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const latest = Math.max(...events.map((e) => Date.parse(e.observed_at)), Date.now());
  const out: IdentityFinding[] = [];
  const admins = events.filter((e) => e.roles?.some((r) => /admin|administrator/i.test(r)));
  const lastLogin = new Map<string, number>();
  for (const e of events) {
    const u = e.user_principal;
    if (!u) continue;
    const t = Date.parse(e.observed_at);
    lastLogin.set(u, Math.max(lastLogin.get(u) ?? 0, t));
  }
  for (const e of admins) {
    const u = e.user_principal;
    if (!u) continue;
    const last = lastLogin.get(u) ?? Date.parse(e.observed_at);
    const days = (latest - last) / 86_400_000;
    if (days > 45) {
      out.push(
        finding(
          e.tenant_id,
          "dormant_admin_account",
          days > 120 ? "high" : "medium",
          0.68,
          "Dormant privileged account activity window",
          `Admin-class principal ${u} shows no recent sign-ins within analysis horizon (${Math.round(days)}d).`,
          u,
          [e.event_id],
          "Disable unused admins, require PIM/JIT, validate last-use justification.",
        ),
      );
    }
  }
  return dedupeByPrincipal(out);
}

function dedupeByPrincipal(findings: IdentityFinding[]): IdentityFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = `${f.signal_type}|${f.affected_principal ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function detectPrivilegeEscalation(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const e of events) {
    if (e.is_admin_action && /role|assign|elevate/i.test(JSON.stringify(e.raw))) {
      out.push(
        finding(
          e.tenant_id,
          "privilege_escalation",
          "high",
          0.76,
          "Privileged role or elevation signal",
          `Administrative change observed for ${e.user_principal ?? "unknown actor"}.`,
          e.user_principal,
          [e.event_id],
          "Validate change ticket, review PAM logs, roll back unauthorized role assignment.",
        ),
      );
    }
  }
  return out;
}

export function detectSuspiciousOAuth(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const e of events) {
    if (e.is_oauth_consent && (e.application_name?.toLowerCase().includes("unknown") || e.risk_hints?.length)) {
      out.push(
        finding(
          e.tenant_id,
          "suspicious_oauth_grant",
          "high",
          0.71,
          "Suspicious OAuth consent pattern",
          `OAuth-related activity for app ${e.application_name ?? e.application_id ?? "unknown"}.`,
          e.user_principal,
          [e.event_id],
          "Revoke consent, review publisher verification, enforce admin consent workflow.",
        ),
      );
    }
  }
  return out;
}

export function detectServiceAccountAbuse(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  const fails = events.filter(
    (e) => e.is_service_principal && (e.outcome?.toLowerCase().includes("fail") || e.outcome === "failure"),
  );
  if (fails.length >= 3) {
    out.push(
      finding(
        fails[0]!.tenant_id,
        "service_account_abuse",
        "high",
        0.73,
        "Repeated authentication failures for service principal",
        `${fails.length} failed auth patterns for non-human identities.`,
        undefined,
        fails.map((e) => e.event_id),
        "Rotate keys, scope permissions, inspect token issuance and downstream API abuse.",
      ),
    );
  }
  return out;
}

export function detectExcessivePermissions(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const e of events) {
    const n = e.roles?.length ?? 0;
    if (n >= 6) {
      out.push(
        finding(
          e.tenant_id,
          "excessive_permissions",
          "medium",
          0.62,
          "Broad role assignment surface",
          `Principal ${e.user_principal ?? "unknown"} carries ${n} role assignments in snapshot.`,
          e.user_principal,
          [e.event_id],
          "Rightsize roles, introduce separation of duties, prefer task-specific roles.",
        ),
      );
    }
  }
  return dedupeByPrincipal(out);
}

export function detectNewAdminOutsidePolicy(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const e of events) {
    const hints = (e.risk_hints ?? []).join(" ").toLowerCase();
    if (hints.includes("outside_policy") || hints.includes("unapproved_admin")) {
      out.push(
        finding(
          e.tenant_id,
          "new_admin_outside_policy",
          "critical",
          0.9,
          "New admin created outside policy",
          "Simulated or flagged creation of privileged identity without approved change window.",
          e.user_principal,
          [e.event_id],
          "Suspend account pending investigation, revert role assignment, open incident.",
        ),
      );
    }
  }
  return out;
}

export function detectConditionalAccessDrift(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  const out: IdentityFinding[] = [];
  for (const e of events) {
    if (e.is_policy_change) {
      out.push(
        finding(
          e.tenant_id,
          "conditional_access_drift",
          "medium",
          0.65,
          "Identity policy / conditional access drift signal",
          `Policy-related change detected (${e.event_category}).`,
          e.user_principal,
          [e.event_id],
          "Review change record, run policy diff, validate emergency break-glass procedures.",
        ),
      );
    }
  }
  return dedupeByPrincipal(out);
}

export function runAllIdentityDetectors(events: NormalizedIdentityEvent[]): IdentityFinding[] {
  if (events.length === 0) return [];
  return [
    ...detectImpossibleTravel(events),
    ...detectMfaFatigue(events),
    ...detectRiskySignIns(events),
    ...detectDormantAdmin(events),
    ...detectPrivilegeEscalation(events),
    ...detectSuspiciousOAuth(events),
    ...detectServiceAccountAbuse(events),
    ...detectExcessivePermissions(events),
    ...detectNewAdminOutsidePolicy(events),
    ...detectConditionalAccessDrift(events),
  ];
}

export function scoreIdentityRiskFromFindings(findings: IdentityFinding[]): number {
  let score = 0;
  for (const f of findings) {
    score += SEVERITY_WEIGHT[f.severity] * f.confidence;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
