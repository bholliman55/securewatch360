import { getSupabaseAdminClient } from "@/lib/supabase";

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

export type AwarenessCampaign = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  name: string;
  campaign_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AwarenessAssignment = {
  id: string;
  campaign_id: string | null;
  tenant_id: string;
  client_id: string | null;
  user_email: string;
  user_name: string | null;
  status: string;
  assigned_at: string | null;
  completed_at: string | null;
  score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PhishingSimulation = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  campaign_id: string | null;
  name: string;
  status: string;
  sent_count: number | null;
  opened_count: number | null;
  clicked_count: number | null;
  reported_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AwarenessMetrics = {
  activeCampaigns: number;
  completionRate: number;
  overdueTraining: number;
  phishingClickRate: number;
};

type SupabaseErrorLike = {
  message?: string;
};

const CAMPAIGN_COLUMNS =
  "id, tenant_id, client_id, name, campaign_type, status, start_date, end_date, created_at, updated_at";
const ASSIGNMENT_COLUMNS =
  "id, campaign_id, tenant_id, client_id, user_email, user_name, status, assigned_at, completed_at, score, created_at, updated_at";
const PHISHING_COLUMNS =
  "id, tenant_id, client_id, campaign_id, name, status, sent_count, opened_count, clicked_count, reported_count, created_at, updated_at";

function optionalClientFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  clientId?: string | null
): T {
  return clientId ? query.eq("client_id", clientId) : query;
}

function throwAwarenessDataError(operation: string, error: SupabaseErrorLike): never {
  throw new Error(`${operation} failed: ${error.message ?? "Supabase returned an error"}`);
}

function isCompletedAssignment(assignment: AwarenessAssignment): boolean {
  const status = assignment.status.trim().toLowerCase();
  return status === "completed" || Boolean(assignment.completed_at);
}

function isAssignedIncomplete(assignment: AwarenessAssignment): boolean {
  const status = assignment.status.trim().toLowerCase();
  return status === "assigned" || (!isCompletedAssignment(assignment) && status !== "cancelled");
}

function isPastDate(date: string | null, now = new Date()): boolean {
  if (!date) return false;
  const parsed = new Date(`${date}T23:59:59.999Z`);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() < now.getTime();
}

export async function getAwarenessCampaigns(
  tenantId: string,
  clientId?: string | null
): Promise<AwarenessCampaign[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("awareness_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  query = optionalClientFilter(query, clientId);

  const { data, error } = await query;
  if (error) throwAwarenessDataError("Loading awareness campaigns", error);

  return (data ?? []) as AwarenessCampaign[];
}

export async function getAwarenessAssignments(
  tenantId: string,
  clientId?: string | null,
  campaignId?: string | null
): Promise<AwarenessAssignment[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("awareness_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("assigned_at", { ascending: false });

  query = optionalClientFilter(query, clientId);
  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  const { data, error } = await query;
  if (error) throwAwarenessDataError("Loading awareness assignments", error);

  return (data ?? []) as AwarenessAssignment[];
}

export async function getPhishingSimulations(
  tenantId: string,
  clientId?: string | null
): Promise<PhishingSimulation[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("phishing_simulations")
    .select(PHISHING_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  query = optionalClientFilter(query, clientId);

  const { data, error } = await query;
  if (error) throwAwarenessDataError("Loading phishing simulations", error);

  return (data ?? []) as PhishingSimulation[];
}

export function calculateAwarenessMetrics(
  campaigns: AwarenessCampaign[],
  assignments: AwarenessAssignment[],
  phishingSimulations: PhishingSimulation[]
): AwarenessMetrics {
  const campaignEndDates = new Map(campaigns.map((campaign) => [campaign.id, campaign.end_date]));
  const completedAssignments = assignments.filter(isCompletedAssignment).length;
  const totalAssignments = assignments.length;
  const sentCount = phishingSimulations.reduce(
    (sum, simulation) => sum + (Number(simulation.sent_count) || 0),
    0
  );
  const clickedCount = phishingSimulations.reduce(
    (sum, simulation) => sum + (Number(simulation.clicked_count) || 0),
    0
  );

  return {
    activeCampaigns: campaigns.filter(
      (campaign) => campaign.status.trim().toLowerCase() === "active"
    ).length,
    completionRate: totalAssignments > 0 ? completedAssignments / totalAssignments : 0,
    overdueTraining: assignments.filter((assignment) => {
      if (!assignment.campaign_id || !isAssignedIncomplete(assignment)) return false;
      return isPastDate(campaignEndDates.get(assignment.campaign_id) ?? null);
    }).length,
    phishingClickRate: sentCount > 0 ? clickedCount / sentCount : 0,
  };
}

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
