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

export const trainingService = {
  async getModules(_tenantId?: string | null): Promise<TrainingModule[]> {
    return [];
  },

  async getMetrics(_tenantId?: string | null): Promise<TrainingMetrics> {
    return {
      totalModules: 0,
      activeModules: 0,
      totalEnrolled: 0,
      totalCompleted: 0,
      avgCompletionRate: 0,
      categoryStats: [] as { name: string; enrolled: number; completed: number; rate: number }[],
    };
  },
};
