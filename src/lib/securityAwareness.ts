type FindingSignal = {
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string | null;
  title: string;
};

type AwarenessTopic =
  | "phishing"
  | "credential-theft"
  | "ransomware"
  | "web-security"
  | "cloud-misconfiguration"
  | "endpoint-hardening"
  | "incident-reporting";

export type AwarenessTrainingRecommendation = {
  topic: AwarenessTopic;
  priority: "standard" | "elevated" | "urgent";
  audience: "all_users" | "engineering" | "it_ops" | "security_team";
  trainingFormat: "micro-learning" | "tabletop" | "simulation";
  rationale: string;
  basedOn: string[];
};

export type AwarenessTrainingPlan = {
  generatedAt: string;
  tenantId: string;
  realWorldSignals: string[];
  companySignals: string[];
  recommendations: AwarenessTrainingRecommendation[];
};

function parseSignalList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function scoreTopic(topic: AwarenessTopic, findings: FindingSignal[]): number {
  let score = 0;
  for (const finding of findings) {
    const text = `${finding.category ?? ""} ${finding.title}`.toLowerCase();
    const severityWeight =
      finding.severity === "critical"
        ? 5
        : finding.severity === "high"
          ? 4
          : finding.severity === "medium"
            ? 2
            : 1;

    if (topic === "phishing" && (text.includes("phish") || text.includes("social engineering"))) {
      score += 3 * severityWeight;
    }
    if (
      topic === "credential-theft" &&
      (text.includes("credential") || text.includes("password") || text.includes("token"))
    ) {
      score += 3 * severityWeight;
    }
    if (topic === "ransomware" && (text.includes("ransom") || text.includes("malware"))) {
      score += 3 * severityWeight;
    }
    if (
      topic === "web-security" &&
      (text.includes("xss") || text.includes("sql") || text.includes("injection") || text.includes("zap"))
    ) {
      score += 2 * severityWeight;
    }
    if (
      topic === "cloud-misconfiguration" &&
      (text.includes("misconfig") || text.includes("public bucket") || text.includes("iam"))
    ) {
      score += 2 * severityWeight;
    }
    if (
      topic === "endpoint-hardening" &&
      (text.includes("endpoint") ||
        text.includes("port") ||
        text.includes("network") ||
        text.includes("exposure"))
    ) {
      score += 2 * severityWeight;
    }
    if (topic === "incident-reporting" && finding.severity !== "info") {
      score += severityWeight;
    }
  }

  return score;
}

function mapPriority(score: number): "standard" | "elevated" | "urgent" {
  if (score >= 20) return "urgent";
  if (score >= 10) return "elevated";
  return "standard";
}

export function buildAwarenessTrainingPlan(args: {
  tenantId: string;
  findings: FindingSignal[];
  realWorldSignals?: string[];
  companySignals?: string[];
}): AwarenessTrainingPlan {
  const realWorldSignals =
    args.realWorldSignals && args.realWorldSignals.length > 0
      ? args.realWorldSignals
      : parseSignalList(process.env.SECURITY_AWARENESS_REAL_WORLD_SIGNALS);
  const companySignals =
    args.companySignals && args.companySignals.length > 0
      ? args.companySignals
      : parseSignalList(process.env.SECURITY_AWARENESS_COMPANY_SIGNALS);

  const topics: AwarenessTopic[] = [
    "phishing",
    "credential-theft",
    "ransomware",
    "web-security",
    "cloud-misconfiguration",
    "endpoint-hardening",
    "incident-reporting",
  ];

  const recommendations = topics
    .map((topic) => {
      const score = scoreTopic(topic, args.findings);
      return { topic, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((row): AwarenessTrainingRecommendation => {
      const priority = mapPriority(row.score);
      return {
        topic: row.topic,
        priority,
        audience:
          row.topic === "cloud-misconfiguration"
            ? "engineering"
            : row.topic === "endpoint-hardening"
              ? "it_ops"
              : row.topic === "incident-reporting"
                ? "all_users"
                : "all_users",
        trainingFormat:
          row.topic === "incident-reporting"
            ? "tabletop"
            : row.topic === "phishing"
              ? "simulation"
              : "micro-learning",
        rationale: `Topic score=${row.score} based on current finding patterns and severity mix.`,
        basedOn: [...realWorldSignals, ...companySignals],
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    tenantId: args.tenantId,
    realWorldSignals,
    companySignals,
    recommendations,
  };
}
