import { useState, useEffect } from "react";
import { Shield, Sun, Moon, Settings, User, LogOut, RefreshCw, Building2, ChevronDown } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";

export default function TopNav({ onRefresh }: { onRefresh?: () => void }) {
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

  return (
    <nav className="bg-[var(--sw-surface)]/95 border-b border-[var(--sw-border)] px-6 py-4 transition-colors duration-200 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-[#1565c0] to-[#29b6f6] p-2 rounded-lg shadow-lg shadow-[#29b6f6]/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-text-primary)] tracking-tight">SecureWatch360</h1>
            <p className="text-xs uppercase tracking-[0.14em] text-[#29b6f6]">Security Operations Center</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {tenants.length > 1 ? (
            <div className="relative flex items-center gap-2 px-3 py-2 bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-lg hover:border-[#29b6f6] transition-colors group">
              <Building2 className="w-4 h-4 text-[var(--sw-text-muted)] group-hover:text-[#29b6f6] transition-colors shrink-0" />
              <select
                value={selectedTenantId ?? ""}
                onChange={(e) => setSelectedTenantId(e.target.value || null)}
                aria-label="Select organization"
                title="Select organization"
                className="bg-transparent text-sm font-medium text-[var(--sw-text-primary)] focus:outline-none cursor-pointer pr-5 appearance-none"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--sw-text-muted)] pointer-events-none absolute right-2.5" />
            </div>
          ) : selectedTenantName ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#1565c0]/10 border border-[#1e88e5]/40 rounded-lg">
              <Building2 className="w-4 h-4 text-[#29b6f6] shrink-0" />
              <span className="text-sm font-semibold text-[#29b6f6]">{selectedTenantName}</span>
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
