// @vitest-environment jsdom
/**
 * UI unit tests for Posture Roadmap components.
 *
 * Tests: EmptyState, GapAnalysisPanel, AutomationModal, RoadmapPanel
 * Uses React Testing Library + jsdom.
 */

import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ─── Mock fetch (used by StatusSelect inside RoadmapPanel) ────────────────────
beforeAll(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
});

// ─── Component imports ────────────────────────────────────────────────────────
import { EmptyState } from "@/components/posture-roadmap/EmptyState";
import { GapAnalysisPanel } from "@/components/posture-roadmap/GapAnalysisPanel";
import { AutomationModal } from "@/components/posture-roadmap/AutomationModal";
import { RoadmapPanel } from "@/components/posture-roadmap/RoadmapPanel";

// ─── Type imports ─────────────────────────────────────────────────────────────
import type { PostureRoadmapItem, GapItem } from "@/types/posture-roadmap";

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeRoadmapItem(overrides: Partial<PostureRoadmapItem> = {}): PostureRoadmapItem {
  return {
    id: "item-1",
    tenant_id: "tenant-test",
    title: "Enforce MFA for All Privileged Users",
    category: "identity_access",
    related_framework: "CMMC_L2",
    current_state: "MFA partial",
    desired_state: "MFA for all privileged",
    priority: "critical",
    estimated_effort: "low",
    estimated_impact_score: 95,
    recommended_action: "Enable Conditional Access policy",
    automation_level: "now",
    status: "not_started",
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeGapItem(overrides: Partial<GapItem> = {}): GapItem {
  return {
    category: "identity_access",
    categoryLabel: "Identity & Access",
    gapCount: 2,
    criticalCount: 1,
    highCount: 1,
    items: [
      makeRoadmapItem({ id: "item-1", title: "Enforce MFA for All Privileged Users", priority: "critical" }),
      makeRoadmapItem({ id: "item-2", title: "Review Privileged Access Roles", priority: "high", automation_level: "later" }),
    ],
    ...overrides,
  };
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

describe("EmptyState", () => {
  it("renders the title", () => {
    render(
      <EmptyState tenantId="t1" onRunAssessment={() => {}} isGenerating={false} />
    );
    expect(screen.getByText("No Posture Assessment Yet")).toBeInTheDocument();
  });

  it("shows 'Run First Assessment' button when not generating", () => {
    render(
      <EmptyState tenantId="t1" onRunAssessment={() => {}} isGenerating={false} />
    );
    expect(screen.getByText("Run First Assessment")).toBeInTheDocument();
  });

  it("shows 'Generating Assessment...' when isGenerating=true", () => {
    render(
      <EmptyState tenantId="t1" onRunAssessment={() => {}} isGenerating={true} />
    );
    expect(screen.getByText("Generating Assessment...")).toBeInTheDocument();
  });

  it("calls onRunAssessment when button clicked", () => {
    const onRun = vi.fn();
    render(
      <EmptyState tenantId="t1" onRunAssessment={onRun} isGenerating={false} />
    );
    fireEvent.click(screen.getByText("Run First Assessment"));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("button is disabled when isGenerating=true", () => {
    render(
      <EmptyState tenantId="t1" onRunAssessment={() => {}} isGenerating={true} />
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("shows assessment timing subtext", () => {
    render(
      <EmptyState tenantId="t1" onRunAssessment={() => {}} isGenerating={false} />
    );
    expect(screen.getByText(/~30 seconds/i)).toBeInTheDocument();
  });
});

// ─── GapAnalysisPanel ─────────────────────────────────────────────────────────

describe("GapAnalysisPanel — empty state", () => {
  it("renders without crashing when gaps is empty", () => {
    render(<GapAnalysisPanel gaps={[]} />);
  });

  it("renders no category cards when gaps is empty", () => {
    const { container } = render(<GapAnalysisPanel gaps={[]} />);
    // no category label text present
    expect(container.textContent).not.toMatch(/Identity & Access/);
  });
});

describe("GapAnalysisPanel — with gap data", () => {
  it("renders the category label", () => {
    render(<GapAnalysisPanel gaps={[makeGapItem()]} />);
    expect(screen.getByText("Identity & Access")).toBeInTheDocument();
  });

  it("shows the gap count", () => {
    render(<GapAnalysisPanel gaps={[makeGapItem({ gapCount: 2 })]} />);
    expect(screen.getByText(/2 gaps/i)).toBeInTheDocument();
  });

  it("shows critical count badge when criticalCount > 0", () => {
    render(<GapAnalysisPanel gaps={[makeGapItem({ criticalCount: 1 })]} />);
    expect(screen.getByText(/1 critical/i)).toBeInTheDocument();
  });

  it("does not show critical count badge when criticalCount is 0", () => {
    // Override items to only have high-priority so no critical badge appears
    const noCriticalGap = makeGapItem({
      criticalCount: 0,
      highCount: 1,
      gapCount: 1,
      items: [makeRoadmapItem({ id: "nc-1", priority: "high", title: "High Priority Item" })],
    });
    render(<GapAnalysisPanel gaps={[noCriticalGap]} />);
    // "· N critical" span should not appear
    expect(screen.queryByText(/\d+ critical/i)).not.toBeInTheDocument();
  });

  it("renders roadmap item titles within gap cards", () => {
    render(<GapAnalysisPanel gaps={[makeGapItem()]} />);
    const titles = screen.getAllByText("Enforce MFA for All Privileged Users");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("renders high count badge when highCount > 0", () => {
    render(<GapAnalysisPanel gaps={[makeGapItem({ highCount: 2 })]} />);
    expect(screen.getByText(/2 high/i)).toBeInTheDocument();
  });

  it("renders multiple category sections", () => {
    const gaps = [
      makeGapItem({ category: "identity_access", categoryLabel: "Identity & Access" }),
      makeGapItem({ category: "backup_recovery", categoryLabel: "Backup & Recovery", items: [makeRoadmapItem({ id: "br-1", category: "backup_recovery", title: "Configure immutable backups" })] }),
    ];
    render(<GapAnalysisPanel gaps={gaps} />);
    expect(screen.getByText("Identity & Access")).toBeInTheDocument();
    expect(screen.getByText("Backup & Recovery")).toBeInTheDocument();
  });
});

// ─── AutomationModal ──────────────────────────────────────────────────────────

describe("AutomationModal", () => {
  const noop = () => {};

  it("renders nothing when item is null", () => {
    const { container } = render(
      <AutomationModal item={null} onClose={noop} onRequestApproval={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders item title when item is provided", () => {
    const item = makeRoadmapItem();
    render(<AutomationModal item={item} onClose={noop} onRequestApproval={noop} />);
    expect(screen.getByText("Enforce MFA for All Privileged Users")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    const item = makeRoadmapItem();
    render(<AutomationModal item={item} onClose={onClose} onRequestApproval={noop} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    const item = makeRoadmapItem();
    render(<AutomationModal item={item} onClose={onClose} onRequestApproval={noop} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'Preview Automation Plan' button in default view", () => {
    const item = makeRoadmapItem({ automation_level: "now" });
    render(<AutomationModal item={item} onClose={noop} onRequestApproval={noop} />);
    expect(screen.getByText(/Preview Automation Plan/i)).toBeInTheDocument();
  });

  it("switches to preview view and shows 'Execution Steps' section", () => {
    const item = makeRoadmapItem({ automation_level: "now" });
    render(<AutomationModal item={item} onClose={noop} onRequestApproval={noop} />);
    fireEvent.click(screen.getByText(/Preview Automation Plan/i));
    expect(screen.getByText(/Execution Steps/i)).toBeInTheDocument();
  });
});

// ─── RoadmapPanel ─────────────────────────────────────────────────────────────

describe("RoadmapPanel — rendering", () => {
  it("renders item titles", () => {
    const items = [makeRoadmapItem({ id: "item-a", title: "Patch Critical CVEs" })];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    expect(screen.getByText("Patch Critical CVEs")).toBeInTheDocument();
  });

  it("shows 'No items match' message when all items are filtered out", () => {
    // Item is not_started; filter to completed → nothing shows
    const items = [makeRoadmapItem({ status: "not_started" })];
    const { getByRole } = render(<RoadmapPanel items={items} tenantId="t1" />);
    // Change status filter select to "completed"
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "completed" } });
    expect(screen.getByText("No items match the current filters.")).toBeInTheDocument();
  });

  it("shows total item count in stats bar", () => {
    const items = [
      makeRoadmapItem({ id: "i1" }),
      makeRoadmapItem({ id: "i2", priority: "high", automation_level: "later" }),
    ];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    // "Total" stat label
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("shows 'Automatable' stat count", () => {
    const items = [
      makeRoadmapItem({ id: "i1", automation_level: "now" }),
      makeRoadmapItem({ id: "i2", automation_level: "not_yet" }),
    ];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    expect(screen.getByText("Automatable")).toBeInTheDocument();
  });

  it("shows automation button for items with automation_level='now'", () => {
    const items = [makeRoadmapItem({ id: "i1", automation_level: "now" })];
    const onAutomate = vi.fn();
    render(<RoadmapPanel items={items} tenantId="t1" onAutomate={onAutomate} />);
    // "Automate Now" button should appear
    expect(screen.getByText(/Automate Now/i)).toBeInTheDocument();
  });

  it("does not show automation button for items with automation_level='not_yet'", () => {
    const items = [makeRoadmapItem({ id: "i1", automation_level: "not_yet" })];
    render(<RoadmapPanel items={items} tenantId="t1" onAutomate={() => {}} />);
    expect(screen.queryByText(/Automate Now/i)).not.toBeInTheDocument();
  });
});

describe("RoadmapPanel — status dropdown", () => {
  it("StatusSelect renders with current status selected", () => {
    const items = [makeRoadmapItem({ id: "i1", status: "in_progress" })];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    // All selects: status-filter, priority-filter, category-filter, then item StatusSelect(s)
    const selects = Array.from(document.querySelectorAll("select"));
    const statusSelect = selects[selects.length - 1] as HTMLSelectElement;
    expect(statusSelect.value).toBe("in_progress");
  });

  it("triggers fetch when StatusSelect is changed", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;
    const items = [makeRoadmapItem({ id: "i1", status: "not_started" })];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    const selects = Array.from(document.querySelectorAll("select"));
    const statusSelect = selects[selects.length - 1] as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: "completed" } });
    });
    // fetch should have been called with the patch endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/posture-roadmap/roadmap/i1"),
      expect.objectContaining({ method: "PATCH" })
    );
  });
});

describe("RoadmapPanel — framework filter", () => {
  it("shows all items before category filter is applied", () => {
    const items = [
      makeRoadmapItem({ id: "i1", category: "identity_access", title: "MFA Item" }),
      makeRoadmapItem({ id: "i2", category: "backup_recovery", title: "Backup Item" }),
    ];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    expect(screen.getByText("MFA Item")).toBeInTheDocument();
    expect(screen.getByText("Backup Item")).toBeInTheDocument();
  });

  it("filters out items not matching the selected category", () => {
    const items = [
      makeRoadmapItem({ id: "i1", category: "identity_access", title: "MFA Item" }),
      makeRoadmapItem({ id: "i2", category: "backup_recovery", title: "Backup Item" }),
    ];
    render(<RoadmapPanel items={items} tenantId="t1" />);
    // Category select is the 3rd select (index 2)
    const selects = Array.from(document.querySelectorAll("select"));
    fireEvent.change(selects[2], { target: { value: "identity_access" } });
    expect(screen.getByText("MFA Item")).toBeInTheDocument();
    expect(screen.queryByText("Backup Item")).not.toBeInTheDocument();
  });
});
