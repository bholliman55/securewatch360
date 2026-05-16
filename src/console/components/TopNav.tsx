'use client';

import { useState, useEffect } from "react";
import { Sun, Moon, Settings, User, LogOut, RefreshCw, Building2, ShieldCheck, DatabaseZap } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
const secureWatchLogo = '/images/securewatch360-logo.png';

export default function TopNav({
  onRefresh,
  onOpenSettings,
  onLoadDemoData,
  seedState = "idle",
}: {
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onLoadDemoData?: () => void;
  seedState?: "idle" | "loading" | "done" | "error";
}) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { selectedTenantId, setSelectedTenantId, tenants, selectedTenantName } = useTenant();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const roleLabel = tenants.find((t) => t.id === selectedTenantId)?.role ?? "member";
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId || null);
  };

  return (
    <nav className="bg-[var(--sw-surface)]/96 border-b border-[var(--sw-border)] px-6 py-4 transition-colors duration-200 backdrop-blur supports-[backdrop-filter]:bg-[var(--sw-surface)]/82 shadow-[0_8px_28px_-22px_rgba(17,45,78,0.45)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src={secureWatchLogo}
            alt="SecureWatch360"
            className="h-12 w-auto rounded-lg border border-[color:color-mix(in_srgb,var(--sw-accent)_30%,transparent)] shadow-[0_12px_24px_-16px_rgba(17,45,78,0.8)]"
          />
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-text-primary)] tracking-tight">SecureWatch360</h1>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--sw-accent-bright)]">
              One Platform. Total Protection. Continuous Compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex min-w-[260px] max-w-[360px] items-center gap-3 rounded-lg border border-[color:color-mix(in_srgb,var(--sw-accent)_38%,transparent)] bg-[color:color-mix(in_srgb,var(--sw-accent)_9%,transparent)] px-3 py-2 shadow-[0_10px_24px_-22px_rgba(30,136,229,0.9)]">
            <Building2 className="h-5 w-5 shrink-0 text-[var(--sw-accent)]" />
            <div className="min-w-0 flex-1">
              <label
                htmlFor="tenant-selector"
                className="block text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-[var(--sw-text-muted)]"
              >
                Active tenant
              </label>
              <select
                id="tenant-selector"
                value={selectedTenantId ?? ""}
                onChange={(event) => handleTenantChange(event.target.value)}
                disabled={tenants.length === 0}
                title={selectedTenantName ? `Switch active tenant from ${selectedTenantName}` : "Select active tenant"}
                className="mt-1 w-full min-w-0 cursor-pointer truncate rounded-md border border-transparent bg-[var(--sw-surface-elevated)] px-2 py-1 text-sm font-bold text-[var(--sw-text-primary)] outline-none focus:border-[var(--sw-accent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--sw-accent)_32%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
              >
                {tenants.length === 0 ? (
                  <option value="" style={{ backgroundColor: "#10243a", color: "#eaf6ff" }}>
                    No tenants available
                  </option>
                ) : (
                  tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id} style={{ backgroundColor: "#10243a", color: "#eaf6ff" }}>
                      {tenant.name} ({tenant.role})
                    </option>
                  ))
                )}
              </select>
              {selectedTenant ? (
                <div className="mt-1 truncate text-[10px] font-medium text-[var(--sw-text-muted)]">
                  {selectedTenant.id.slice(0, 8)}...{selectedTenant.id.slice(-4)}
                </div>
              ) : null}
            </div>
            <ShieldCheck className="hidden h-4 w-4 shrink-0 text-[var(--sw-pulse)] sm:block" />
          </div>

          <div className="hidden md:flex flex-col items-end">
            <div className="text-sm font-semibold text-[var(--sw-text-primary)] tabular-nums">{formatTime(currentTime)}</div>
            <div className="text-xs text-[var(--sw-text-muted)]">{formatDate(currentTime)}</div>
          </div>

          <div className="flex items-center gap-1">
            {onLoadDemoData && (
              <button
                onClick={onLoadDemoData}
                disabled={seedState === "loading" || seedState === "done"}
                title={seedState === "done" ? "Demo data loaded" : "Load demo data into your tenant"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--sw-accent-bright)] border border-[color:color-mix(in_srgb,var(--sw-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--sw-accent)_8%,transparent)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <DatabaseZap className="w-3.5 h-3.5 shrink-0" />
                {seedState === "loading" ? "Loading…" : seedState === "done" ? "Loaded ✓" : "Demo Data"}
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-all duration-200"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-[#29b6f6]" />
              ) : (
                <Moon className="w-5 h-5 text-[var(--sw-text-muted)]" />
              )}
            </button>

            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-all duration-200"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5 text-[var(--sw-text-muted)]" />
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              className="p-2 rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-[var(--sw-text-muted)]" />
            </button>
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-[var(--sw-border)]">
            <div className="hidden md:flex flex-col items-end">
              <div className="text-sm font-medium text-[var(--sw-text-primary)]">
                {user?.email?.split("@")[0] || "User"}
              </div>
              <div className="text-xs text-[var(--sw-text-muted)] capitalize">
                {selectedTenantName ? `${roleLabel} · ${selectedTenantName}` : roleLabel}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1565c0] to-[#112d4e] flex items-center justify-center shadow">
              <User className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="w-5 h-5 text-[var(--sw-text-muted)]" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
