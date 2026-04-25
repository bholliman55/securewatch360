"use client";

import { FormEvent, useState } from "react";

type FindingRow = {
  id: string;
  severity: string;
  category: string | null;
  title: string;
  status: string;
  asset_type: string;
  exposure: string;
  priority_score: number;
  assigned_to_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FindingsResponse = {
  ok: boolean;
  findings?: FindingRow[];
  error?: string;
};

type Filters = {
  tenantId: string;
  severity: string;
  status: string;
};

const initialFilters: Filters = {
  tenantId: "",
  severity: "",
  status: "",
};

const findingStatuses = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "risk_accepted",
] as const;

function getSeverityClass(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "sw-sev-critical";
  if (normalized === "high") return "sw-sev-high";
  if (normalized === "medium") return "sw-sev-medium";
  if (normalized === "low") return "sw-sev-low";
  return "sw-sev-info";
}

export function FindingsClient() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  function syncDrafts(rows: FindingRow[]) {
    setStatusDrafts(
      Object.fromEntries(rows.map((row) => [row.id, row.status]))
    );
    setAssigneeDrafts(
      Object.fromEntries(rows.map((row) => [row.id, row.assigned_to_user_id ?? ""]))
    );
    setNoteDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const row of rows) {
        next[row.id] = prev[row.id] ?? "";
      }
      return next;
    });
  }

  async function loadFindings(nextFilters: Filters) {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (nextFilters.tenantId.trim()) params.set("tenantId", nextFilters.tenantId.trim());
      if (nextFilters.severity.trim()) params.set("severity", nextFilters.severity.trim());
      if (nextFilters.status.trim()) params.set("status", nextFilters.status.trim());

      const query = params.toString();
      const response = await fetch(`/api/findings${query ? `?${query}` : ""}`, { method: "GET" });
      const json = (await response.json()) as FindingsResponse;

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to load findings");
      }

      const loadedFindings = json.findings ?? [];
      setFindings(loadedFindings);
      syncDrafts(loadedFindings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filters.tenantId.trim()) {
      setError("tenantId is required");
      setFindings([]);
      return;
    }
    void loadFindings(filters);
  }

  function updateFindingInState(id: string, next: Partial<FindingRow>) {
    setFindings((prev) => prev.map((finding) => (finding.id === id ? { ...finding, ...next } : finding)));
  }

  async function saveStatus(id: string) {
    setActionMessage(null);
    const status = statusDrafts[id];
    try {
      const response = await fetch(`/api/findings/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        finding?: Pick<FindingRow, "status" | "updated_at">;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.finding) {
        throw new Error(json.error || "Failed to update status");
      }
      updateFindingInState(id, json.finding);
      setActionMessage("Finding status updated.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function saveAssignee(id: string) {
    setActionMessage(null);
    const assignedToUserId = assigneeDrafts[id] ?? "";
    try {
      const response = await fetch(`/api/findings/${id}/assignee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        finding?: Pick<FindingRow, "assigned_to_user_id" | "updated_at">;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.finding) {
        throw new Error(json.error || "Failed to update assignee");
      }
      updateFindingInState(id, json.finding);
      setActionMessage("Finding assignment updated.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update assignee");
    }
  }

  async function addNote(id: string) {
    setActionMessage(null);
    const note = (noteDrafts[id] ?? "").trim();
    if (!note) {
      setActionMessage("Enter a note before saving.");
      return;
    }
    try {
      const response = await fetch(`/api/findings/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        finding?: Pick<FindingRow, "notes" | "updated_at">;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.finding) {
        throw new Error(json.error || "Failed to add note");
      }
      updateFindingInState(id, json.finding);
      setNoteDrafts((prev) => ({ ...prev, [id]: "" }));
      setActionMessage("Finding note added.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            value={filters.tenantId}
            onChange={(e) => setFilters((prev) => ({ ...prev, tenantId: e.target.value }))}
            placeholder="uuid (optional)"
            className="sw-input"
          />
        </label>

        <label className="sw-field">
          Severity
          <select
            value={filters.severity}
            onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
            className="sw-input"
          >
            <option value="">All</option>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="info">info</option>
          </select>
        </label>

        <label className="sw-field">
          Status
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="sw-input"
          >
            <option value="">All</option>
            <option value="open">open</option>
            <option value="acknowledged">acknowledged</option>
            <option value="in_progress">in_progress</option>
            <option value="resolved">resolved</option>
            <option value="risk_accepted">risk_accepted</option>
          </select>
        </label>

        <button type="submit" className="sw-button" disabled={loading}>
          {loading ? "Loading..." : "Apply Filters"}
        </button>
      </form>

      {error ? <p className="sw-error">{error}</p> : null}
      {actionMessage ? <p>{actionMessage}</p> : null}
      {!loading && !error && findings.length === 0 && !filters.tenantId.trim() ? (
        <p>Enter tenant ID and apply filters to load findings.</p>
      ) : null}
      {loading ? <p>Loading findings...</p> : null}
      {!loading && !error && findings.length === 0 && filters.tenantId.trim() ? <p>No findings found.</p> : null}

      {!loading && !error && findings.length > 0 ? (
        <table className="sw-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Severity</th>
              <th>Asset</th>
              <th>Exposure</th>
              <th>Category</th>
              <th>Title</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Notes</th>
              <th>Created At</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>{finding.priority_score}</td>
                <td>
                  <span className={`sw-sev ${getSeverityClass(finding.severity)}`}>
                    {finding.severity}
                  </span>
                </td>
                <td>{finding.asset_type}</td>
                <td>{finding.exposure}</td>
                <td>{finding.category ?? "-"}</td>
                <td>{finding.title}</td>
                <td>
                  <select
                    className="sw-input"
                    aria-label="Finding status"
                    value={statusDrafts[finding.id] ?? finding.status}
                    onChange={(e) =>
                      setStatusDrafts((prev) => ({ ...prev, [finding.id]: e.target.value }))
                    }
                  >
                    {findingStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="sw-input"
                    placeholder="user uuid or empty"
                    value={assigneeDrafts[finding.id] ?? ""}
                    onChange={(e) =>
                      setAssigneeDrafts((prev) => ({ ...prev, [finding.id]: e.target.value }))
                    }
                  />
                </td>
                <td>
                  <textarea
                    className="sw-input"
                    rows={3}
                    placeholder="add triage/remediation note"
                    value={noteDrafts[finding.id] ?? ""}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [finding.id]: e.target.value }))
                    }
                  />
                  {finding.notes ? <pre>{finding.notes}</pre> : <span>-</span>}
                </td>
                <td>{new Date(finding.created_at).toLocaleString()}</td>
                <td>{new Date(finding.updated_at).toLocaleString()}</td>
                <td>
                  <button type="button" className="sw-button" onClick={() => void saveStatus(finding.id)}>
                    Save Status
                  </button>
                  <button
                    type="button"
                    className="sw-button"
                    onClick={() => void saveAssignee(finding.id)}
                  >
                    Save Assignee
                  </button>
                  <button type="button" className="sw-button" onClick={() => void addNote(finding.id)}>
                    Add Note
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
