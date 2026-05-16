import { apiJson } from "../lib/apiFetch";

export interface TrainingModule {
  id: string;
  title: string;
  category: string;
  description: string;
  duration_minutes: number;
  completion_rate: number;
  passing_score: number;
  status: string;
  total_enrolled: number;
  total_completed: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingMetrics {
  totalModules: number;
  activeModules: number;
  totalEnrolled: number;
  totalCompleted: number;
  avgCompletionRate: number;
  categoryStats: Array<{ name: string; enrolled: number; completed: number; rate: number }>;
}

type TrainingModulesResponse = {
  ok: boolean;
  modules: TrainingModule[];
  metrics: TrainingMetrics;
};

export type TrainingData = {
  modules: TrainingModule[];
  metrics: TrainingMetrics;
};

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to load security awareness training data.");
  }
  return tenantId;
}

async function fetchTrainingData(tenantId?: string | null): Promise<TrainingData> {
  const tid = requireTenant(tenantId);
  const response = await apiJson<TrainingModulesResponse>(
    `/api/training/modules?tenantId=${encodeURIComponent(tid)}`
  );
  return {
    modules: response.modules ?? [],
    metrics: response.metrics,
  };
}

export const trainingService = {
  async getTrainingData(tenantId?: string | null): Promise<TrainingData> {
    return fetchTrainingData(tenantId);
  },

  async getModules(tenantId?: string | null): Promise<TrainingModule[]> {
    const data = await fetchTrainingData(tenantId);
    return data.modules;
  },

  async getMetrics(tenantId?: string | null): Promise<TrainingMetrics> {
    const data = await fetchTrainingData(tenantId);
    return data.metrics;
  },
};
