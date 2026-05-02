import { useState, useEffect } from "react";
import { Sun, Moon, Settings, User, LogOut, RefreshCw, Building2, ShieldCheck } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import secureWatchLogo from "../assets/securewatch360-logo.png";

export default function TopNav({ onRefresh }: { onRefresh?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { selectedTenantId, tenants, selectedTenantName } = useTenant();
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
          {selectedTenantName ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-[color:color-mix(in_srgb,var(--sw-accent)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--sw-accent)_35%,transparent)] rounded-lg">
              <Building2 className="w-4 h-4 text-[var(--sw-accent)] shrink-0" />
              <span className="text-sm font-semibold text-[var(--sw-accent)]">{selectedTenantName}</span>
              <ShieldCheck className="w-4 h-4 text-[var(--sw-pulse)] shrink-0" />
            </div>
          ) : null}

          <div className="hidden md:flex flex-col items-end">
            <div className="text-sm font-semibold text-[var(--sw-text-primary)] tabular-nums">{formatTime(currentTime)}</div>
            <div className="text-xs text-[var(--sw-text-muted)]">{formatDate(currentTime)}</div>
          </div>

          <div className="flex items-center gap-1">
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
              className="p-2 rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-all duration-200"
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
