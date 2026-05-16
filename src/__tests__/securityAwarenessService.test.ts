import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

const queryBuilder: {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) => unknown;
} = {
  select: vi.fn(() => queryBuilder),
  eq: vi.fn(() => queryBuilder),
  order: vi.fn(() => queryBuilder),
  then: (resolve) => resolve(nextResult),
};

let nextResult: QueryResult = { data: [], error: null };
const mockFrom = vi.fn(() => queryBuilder);

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import {
  calculateAwarenessMetrics,
  getAwarenessAssignments,
  getAwarenessCampaigns,
  getPhishingSimulations,
  type AwarenessAssignment,
  type AwarenessCampaign,
  type PhishingSimulation,
} from "@/lib/securityAwareness";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAMPAIGN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function campaign(overrides: Partial<AwarenessCampaign> = {}): AwarenessCampaign {
  return {
    id: CAMPAIGN_ID,
    tenant_id: TENANT_ID,
    client_id: CLIENT_ID,
    name: "Phishing Basics",
    campaign_type: "training",
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function assignment(overrides: Partial<AwarenessAssignment> = {}): AwarenessAssignment {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    campaign_id: CAMPAIGN_ID,
    tenant_id: TENANT_ID,
    client_id: CLIENT_ID,
    user_email: "user@example.com",
    user_name: "User Example",
    status: "assigned",
    assigned_at: "2026-01-02T00:00:00.000Z",
    completed_at: null,
    score: null,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function phishing(overrides: Partial<PhishingSimulation> = {}): PhishingSimulation {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    tenant_id: TENANT_ID,
    client_id: CLIENT_ID,
    campaign_id: CAMPAIGN_ID,
    name: "Quarterly Simulation",
    status: "completed",
    sent_count: 100,
    opened_count: 40,
    clicked_count: 12,
    reported_count: 8,
    created_at: "2026-01-03T00:00:00.000Z",
    updated_at: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("security awareness data service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextResult = { data: [], error: null };
  });

  it("handles empty data when calculating metrics", () => {
    expect(calculateAwarenessMetrics([], [], [])).toEqual({
      activeCampaigns: 0,
      completionRate: 0,
      overdueTraining: 0,
      phishingClickRate: 0,
    });
  });

  it("calculates awareness metrics without divide-by-zero errors", () => {
    const metrics = calculateAwarenessMetrics(
      [campaign(), campaign({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", status: "draft" })],
      [
        assignment({ status: "completed", completed_at: "2026-01-10T00:00:00.000Z" }),
        assignment({ id: "11111111-1111-4111-8111-111111111111", status: "assigned" }),
        assignment({ id: "22222222-2222-4222-8222-222222222222", status: "in_progress" }),
      ],
      [phishing(), phishing({ id: "33333333-3333-4333-8333-333333333333", sent_count: 0, clicked_count: 5 })]
    );

    expect(metrics).toEqual({
      activeCampaigns: 1,
      completionRate: 1 / 3,
      overdueTraining: 2,
      phishingClickRate: 17 / 100,
    });
  });

  it("loads campaigns, assignments, and phishing simulations with tenant/client filters", async () => {
    nextResult = { data: [campaign()], error: null };
    await expect(getAwarenessCampaigns(TENANT_ID, CLIENT_ID)).resolves.toHaveLength(1);
    expect(mockFrom).toHaveBeenLastCalledWith("awareness_campaigns");
    expect(queryBuilder.eq).toHaveBeenCalledWith("tenant_id", TENANT_ID);
    expect(queryBuilder.eq).toHaveBeenCalledWith("client_id", CLIENT_ID);

    nextResult = { data: [assignment()], error: null };
    await expect(getAwarenessAssignments(TENANT_ID, CLIENT_ID, CAMPAIGN_ID)).resolves.toHaveLength(1);
    expect(mockFrom).toHaveBeenLastCalledWith("awareness_assignments");
    expect(queryBuilder.eq).toHaveBeenCalledWith("campaign_id", CAMPAIGN_ID);

    nextResult = { data: [phishing()], error: null };
    await expect(getPhishingSimulations(TENANT_ID, CLIENT_ID)).resolves.toHaveLength(1);
    expect(mockFrom).toHaveBeenLastCalledWith("phishing_simulations");
  });

  it("surfaces Supabase errors with operation context", async () => {
    nextResult = { data: null, error: { message: "relation does not exist" } };

    await expect(getAwarenessCampaigns(TENANT_ID)).rejects.toThrow(
      "Loading awareness campaigns failed: relation does not exist"
    );
  });
});
