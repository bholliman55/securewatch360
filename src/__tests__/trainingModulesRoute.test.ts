import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const trainingRows = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: null,
    title: "Phishing Recognition and Reporting",
    category: "phishing",
    description: "Recognize suspicious messages.",
    duration_minutes: 18,
    completion_rate: 82,
    passing_score: 80,
    status: "active",
    total_enrolled: 120,
    total_completed: 98,
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    tenant_id: TENANT_ID,
    title: "Incident Reporting Tabletop",
    category: "incident_reporting",
    description: "Practice escalation.",
    duration_minutes: 30,
    completion_rate: 50,
    passing_score: 80,
    status: "active",
    total_enrolled: 10,
    total_completed: 5,
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
  },
];

const mockRequireTenantAccess = vi.fn();
const queryBuilder: {
  select: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  then: (resolve: (value: { data: typeof trainingRows; error: null }) => unknown) => unknown;
} = {
  select: vi.fn(() => queryBuilder),
  or: vi.fn(() => queryBuilder),
  order: vi.fn(() => queryBuilder),
  eq: vi.fn(() => queryBuilder),
  then: (resolve) => resolve({ data: trainingRows, error: null }),
};
const mockFrom = vi.fn(() => queryBuilder);

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: (...args: unknown[]) => mockRequireTenantAccess(...args),
}));

import { GET } from "@/app/api/training/modules/route";

describe("GET /api/training/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireTenantAccess.mockResolvedValue({ ok: true, userId: USER_ID, role: "analyst" });
  });

  it("loads global and tenant training modules from Supabase and returns metrics", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/training/modules?tenantId=${TENANT_ID}`)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mockFrom).toHaveBeenCalledWith("training_modules");
    expect(queryBuilder.or).toHaveBeenCalledWith(`tenant_id.is.null,tenant_id.eq.${TENANT_ID}`);
    expect(body.modules).toHaveLength(2);
    expect(body.metrics).toMatchObject({
      totalModules: 2,
      activeModules: 2,
      totalEnrolled: 130,
      totalCompleted: 103,
      avgCompletionRate: 79,
    });
  });
});
