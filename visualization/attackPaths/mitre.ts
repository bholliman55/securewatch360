/**
 * Lightweight MITRE ATT&CK technique → tactic mapping for visualization overlays.
 * Extend the catalog as product scenarios grow; unknown ids still render with generic tactic.
 */

export const GENERIC_TACTIC_ID = "unspecified" as const;

/** Curated subset of enterprise tactics (ATT&CK style ids). */
export const MITRE_TACTIC_LABELS: Record<string, string> = {
  "initial-access": "Initial Access",
  execution: "Execution",
  persistence: "Persistence",
  "privilege-escalation": "Privilege Escalation",
  "defense-evasion": "Defense Evasion",
  "credential-access": "Credential Access",
  discovery: "Discovery",
  "lateral-movement": "Lateral Movement",
  collection: "Collection",
  "command-and-control": "Command and Control",
  exfiltration: "Exfiltration",
  impact: "Impact",
  [GENERIC_TACTIC_ID]: "Unmapped technique",
};

/** Technique id → tactic id (kebab-case). */
const TECHNIQUE_TO_TACTIC: Record<string, string> = {
  T1566: "initial-access",
  "T1566.001": "initial-access",
  "T1566.002": "initial-access",
  T1190: "initial-access",
  T1133: "initial-access",
  T1078: "defense-evasion",
  T1059: "execution",
  "T1059.001": "execution",
  "T1059.003": "execution",
  T1047: "execution",
  T1547: "persistence",
  T1053: "persistence",
  T1068: "privilege-escalation",
  T1021: "lateral-movement",
  "T1021.001": "lateral-movement",
  T1003: "credential-access",
  T1046: "discovery",
  T1048: "exfiltration",
  T1486: "impact",
  T1071: "command-and-control",
  T1105: "command-and-control",
};

function normalizeTechniqueId(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (TECHNIQUE_TO_TACTIC[t]) return t;
  const base = t.match(/^(T\d{4})/);
  if (base && TECHNIQUE_TO_TACTIC[base[1]!]) return base[1]!;
  return t;
}

export function resolveMitreTacticId(techniqueId: string): string {
  const id = normalizeTechniqueId(techniqueId);
  return TECHNIQUE_TO_TACTIC[id] ?? GENERIC_TACTIC_ID;
}

export function resolveMitreTacticLabel(techniqueId: string): string {
  const tacticId = resolveMitreTacticId(techniqueId);
  return MITRE_TACTIC_LABELS[tacticId] ?? MITRE_TACTIC_LABELS[GENERIC_TACTIC_ID]!;
}
