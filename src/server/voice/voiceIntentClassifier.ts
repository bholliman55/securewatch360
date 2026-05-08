/**
 * Deterministic voice-intent classifier.
 *
 * Why deterministic? The voice gateway is a privileged surface — a
 * misclassification can isolate an endpoint or disable an account. Per the
 * V4 engineering guardrails, decision-impacting paths must be deterministic
 * and auditable, so this classifier intentionally ships without an LLM hop
 * on the hot path. An ElevenLabs-side LLM may still help shape the spoken
 * input, but the binding from transcript → privileged intent happens here.
 *
 * The classifier returns {@link ClassifiedVoiceCommand}; downstream code uses
 * the embedded {@link CommandSafetyLevel} (sourced from {@link VOICE_INTENT_METADATA})
 * rather than re-computing it, so safety classification cannot drift.
 */

import {
  type ClassifiedVoiceCommand,
  type VoiceCommandSlots,
  type VoiceIntent,
  VOICE_INTENT_METADATA,
} from "./types";

interface IntentRule {
  intent: VoiceIntent;
  /**
   * Patterns are ORed. The first rule whose pattern matches wins, so the
   * order in {@link INTENT_RULES} encodes priority — DESTRUCTIVE/HIGH-risk
   * actions must precede READ-only siblings to avoid being shadowed.
   */
  patterns: RegExp[];
  baseConfidence: number;
  reason: string;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "ISOLATE_ENDPOINT",
    patterns: [
      /\bisolate\s+(?:the\s+)?(?:endpoint|host|machine|device|workstation|laptop|server)\b/i,
      /\bquarantine\s+(?:the\s+)?(?:endpoint|host|machine|device)\b/i,
      /\bnetwork[- ]isolat/i,
    ],
    baseConfidence: 0.9,
    reason: "Matched endpoint isolation phrasing.",
  },
  {
    intent: "DISABLE_USER_ACCOUNT",
    patterns: [
      /\bdisable\s+(?:the\s+)?(?:user(?:'s)?\s+)?account\b/i,
      // Natural possessive phrasing: "disable Sarah's account", "lock Jane's account".
      /\b(?:disable|lock|suspend)\s+(?:the\s+)?[a-z][\w.-]*'s\s+account\b/i,
      /\block\s+(?:the\s+)?user(?:'s)?\s+account\b/i,
      /\bsuspend\s+(?:the\s+)?(?:user|account)\b/i,
      /\brevoke\s+(?:the\s+)?(?:user(?:'s)?\s+)?access\b/i,
    ],
    baseConfidence: 0.9,
    reason: "Matched user-account disable phrasing.",
  },
  {
    intent: "START_INCIDENT_RESPONSE",
    patterns: [
      /\b(?:start|kick\s*off|open|declare|launch)\s+(?:an?\s+)?incident\s*(?:response)?\b/i,
      /\bspin\s*up\s+(?:the\s+)?war\s*room\b/i,
      /\bopen\s+(?:the\s+)?war\s*room\b/i,
    ],
    baseConfidence: 0.85,
    reason: "Matched incident-response activation phrasing.",
  },
  {
    intent: "CREATE_REMEDIATION_TICKET",
    patterns: [
      /\bcreate\s+(?:a\s+)?(?:remediation\s+)?ticket\b/i,
      /\bopen\s+(?:a\s+)?(?:jira|servicenow)\s+ticket\b/i,
      /\bfile\s+(?:a\s+)?remediation\b/i,
    ],
    baseConfidence: 0.82,
    reason: "Matched remediation-ticket creation phrasing.",
  },
  {
    intent: "RUN_EXTERNAL_SCAN",
    patterns: [
      /\b(?:run|start|kick\s*off|launch)\s+(?:an?\s+)?(?:external|attack[- ]surface|osint)\s+scan\b/i,
      /\bscan\s+(?:the\s+)?(?:domain|attack\s+surface|external)\b/i,
      /\bexternal\s+(?:intel(?:ligence)?|discovery)\b/i,
    ],
    baseConfidence: 0.8,
    reason: "Matched external scan phrasing.",
  },
  {
    intent: "RUN_VULNERABILITY_SCAN",
    patterns: [
      /\b(?:run|start|kick\s*off|launch)\s+(?:an?\s+)?(?:vuln(?:erability)?|tenable|authenticated)\s+scan\b/i,
      /\bscan\s+(?:for\s+)?vulnerab/i,
    ],
    baseConfidence: 0.8,
    reason: "Matched vulnerability scan phrasing.",
  },
  {
    intent: "GENERATE_EXECUTIVE_REPORT",
    patterns: [
      /\b(?:generate|build|create|prepare)\s+(?:an?\s+)?(?:exec(?:utive)?|board|summary)\s+report\b/i,
      /\bexecutive\s+(?:summary|briefing|digest)\b/i,
    ],
    baseConfidence: 0.78,
    reason: "Matched executive report phrasing.",
  },
  {
    intent: "CHECK_COMPLIANCE_STATUS",
    patterns: [
      /\b(?:check|show|what(?:'s| is)?)\s+(?:our\s+)?compliance\s+(?:status|posture|score)\b/i,
      /\bcompliance\s+(?:status|posture|score)\b/i,
      /\b(?:nist|hipaa|pci(?:[- ]dss)?|soc\s*2|iso\s*27001|cmmc|fedramp|gdpr|ccpa|cis|cobit)\b/i,
    ],
    baseConfidence: 0.78,
    reason: "Matched compliance posture phrasing.",
  },
  {
    intent: "SUMMARIZE_CLIENT_RISK",
    patterns: [
      /\b(?:summarize|summary\s+of|what(?:'s| is))\s+(?:the\s+)?(?:client|tenant|customer)\s+risk\b/i,
      /\bclient\s+risk\s+(?:summary|posture|profile)\b/i,
      /\brisk\s+summary\b/i,
    ],
    baseConfidence: 0.78,
    reason: "Matched client risk summary phrasing.",
  },
  {
    intent: "SHOW_CRITICAL_FINDINGS",
    patterns: [
      /\b(?:show|list|what\s+are)\s+(?:the\s+|our\s+)?(?:top\s+)?critical\s+findings?\b/i,
      /\bcritical\s+(?:findings?|vulnerabilities|issues)\b/i,
      /\bopen\s+critical\s+(?:findings?|vulnerabilities)\b/i,
    ],
    baseConfidence: 0.78,
    reason: "Matched critical findings phrasing.",
  },
];

const DOMAIN_RE = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})\b/i;
const FINDING_ID_RE = /\bfinding[\s_-]*(?:id\s*[:=]?\s*)?([a-z0-9_-]{6,})\b/i;
// Endpoint / user identifier patterns. We consume any chain of label words
// ("user", "account", "the", "id", optional colons) before locking onto the
// first identifier-shaped token, otherwise a phrase like
// "disable the user account jane.doe@example.com" captures the literal word
// "account" instead of the email.
const ENDPOINT_ID_RE =
  /\b(?:endpoint|host|asset|machine|device)(?:[\s:=-]+(?:id|the))*[\s:=-]+([a-z0-9][a-z0-9._-]{2,})\b/i;
const USER_ID_RE =
  /\b(?:user|account)(?:[\s:=-]+(?:id|account|user|the))*[\s:=-]+([a-z0-9][a-z0-9._@-]*(?:@[a-z0-9.-]+\.[a-z]{2,}|[._-][a-z0-9._-]{2,}))\b/i;
// Natural possessive phrasing: "disable Sarah's account" → captures "Sarah"
// as the user account slot. Used as a fallback only when USER_ID_RE doesn't
// already pull a stronger identifier (email / UUID-style id).
const POSSESSIVE_USER_RE =
  /\b(?:disable|lock|suspend)\s+(?:the\s+)?([a-z][\w.-]*)'s\s+account\b/i;
const FRAMEWORK_RE = /\b(nist|hipaa|pci(?:[- ]dss)?|soc\s*2|iso\s*27001|cmmc|fedramp|gdpr|ccpa|cis|cobit)\b/i;
const SEVERITY_RE = /\b(critical|high|medium|low)\b/i;

function extractSlots(transcript: string): VoiceCommandSlots {
  const slots: VoiceCommandSlots = {};

  const domainMatch = transcript.match(DOMAIN_RE);
  if (domainMatch?.[1]) slots.domain = domainMatch[1].toLowerCase();

  const findingMatch = transcript.match(FINDING_ID_RE);
  if (findingMatch?.[1]) slots.findingId = findingMatch[1];

  const endpointMatch = transcript.match(ENDPOINT_ID_RE);
  if (endpointMatch?.[1]) slots.endpointId = endpointMatch[1];

  const userMatch = transcript.match(USER_ID_RE);
  if (userMatch?.[1]) slots.userAccountId = userMatch[1];

  if (!slots.userAccountId) {
    const possessiveMatch = transcript.match(POSSESSIVE_USER_RE);
    if (possessiveMatch?.[1]) slots.userAccountId = possessiveMatch[1];
  }

  const frameworkMatch = transcript.match(FRAMEWORK_RE);
  if (frameworkMatch?.[1]) slots.framework = frameworkMatch[1].toUpperCase().replace(/\s+/g, "");

  const severityMatch = transcript.match(SEVERITY_RE);
  if (severityMatch?.[1]) {
    slots.severity = severityMatch[1].toLowerCase() as VoiceCommandSlots["severity"];
  }

  return slots;
}

/**
 * Pure, side-effect-free classifier. Returns `UNKNOWN` (with low confidence)
 * for any transcript that doesn't decisively match a rule — the gateway then
 * asks the speaker to clarify rather than guessing at a privileged action.
 */
export function classifyVoiceIntent(transcript: string): ClassifiedVoiceCommand {
  const trimmed = transcript?.trim() ?? "";
  if (!trimmed) {
    return {
      intent: "UNKNOWN",
      safetyLevel: VOICE_INTENT_METADATA.UNKNOWN.safetyLevel,
      slots: {},
      confidence: 0,
      reason: "Empty transcript.",
    };
  }

  const slots = extractSlots(trimmed);

  for (const rule of INTENT_RULES) {
    const matched = rule.patterns.some((p) => p.test(trimmed));
    if (!matched) continue;

    const metadata = VOICE_INTENT_METADATA[rule.intent];
    let confidence = rule.baseConfidence;

    // Bump confidence slightly when we pulled out the slots the router will
    // actually need. This keeps borderline matches from creeping over the
    // confirmation threshold without the operator giving us a real handle.
    const required = metadata.requiredSlots ?? [];
    if (required.length > 0 && required.every((slot) => slots[slot])) {
      confidence = Math.min(0.98, confidence + 0.05);
    }

    return {
      intent: rule.intent,
      safetyLevel: metadata.safetyLevel,
      slots,
      confidence,
      reason: rule.reason,
    };
  }

  return {
    intent: "UNKNOWN",
    safetyLevel: VOICE_INTENT_METADATA.UNKNOWN.safetyLevel,
    slots,
    confidence: 0.2,
    reason: "Transcript did not match any known voice intent.",
  };
}
