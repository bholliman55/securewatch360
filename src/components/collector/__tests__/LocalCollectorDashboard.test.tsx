// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocalCollectorDashboard from "@/components/collector/LocalCollectorDashboard";

type CollectorInventory = {
  collector_id: string;
  collected_at: string;
  host: {
    hostname: string;
    osType: string;
    osRelease: string;
    arch: string;
    cpuCount: number;
    cpuModel: string;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    disk: Array<{ drive: string; freeBytes: number; totalBytes: number }>;
  };
  network: { interfaces: Array<{ address: string; family: string }>; macAddresses: string[] };
  software: { installed: Array<Record<string, unknown>> };
  processes: { count: number };
  ports: { count: number };
  errors: string[];
};

const sampleInventory: CollectorInventory = {
  collector_id: "local-dev",
  collected_at: "2026-05-14T04:40:29.270Z",
  host: {
    hostname: "LAPTOP-TEST",
    osType: "Windows_NT",
    osRelease: "10.0.12345",
    arch: "x64",
    cpuCount: 4,
    cpuModel: "Intel Core i7",
    totalMemoryBytes: 17179869184,
    freeMemoryBytes: 4294967296,
    disk: [{ drive: "C:", freeBytes: 50000000000, totalBytes: 250000000000 }],
  },
  network: {
    interfaces: [{ address: "192.168.1.100", family: "IPv4" }],
    macAddresses: ["aa:bb:cc:dd:ee:ff"],
  },
  software: { installed: [{ name: "Example App", version: "1.0" }] },
  processes: { count: 120 },
  ports: { count: 12 },
  errors: [],
};

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocalCollectorDashboard", () => {
  it("loads and displays collector inventory details", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleInventory,
    }) as unknown as typeof fetch;

    render(<LocalCollectorDashboard />);

    expect(screen.getByText(/Local collector preview/i)).toBeInTheDocument();
    await screen.findByRole("button", { name: /Refresh Collector Data/i });

    await waitFor(() => expect(screen.getByText(/Collector healthy/i)).toBeInTheDocument());

    expect(screen.getByText("LAPTOP-TEST")).toBeInTheDocument();
    expect(screen.getByText(/Windows_NT 10.0.12345/i)).toBeInTheDocument();
    expect(screen.getByText(/192.168.1.100/i)).toBeInTheDocument();
    expect(screen.getByText(/aa:bb:cc:dd:ee:ff/i)).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows an error panel when the API returns a failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Collector not available." }),
    }) as unknown as typeof fetch;

    render(<LocalCollectorDashboard />);

    await waitFor(() => expect(screen.getByText(/Collector error/i)).toBeInTheDocument());
    expect(screen.getByText(/Collector not available./i)).toBeInTheDocument();
  });

  it("refreshes collector data when the button is clicked", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => sampleInventory })
      .mockResolvedValueOnce({ ok: true, json: async () => sampleInventory });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<LocalCollectorDashboard />);

    await waitFor(() => expect(screen.getByText(/Collector healthy/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Refresh Collector Data/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
