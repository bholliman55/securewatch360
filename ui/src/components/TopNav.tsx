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
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg shadow-lg shadow-cyan-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">SecureWatch360</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Security Operations Center</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {tenants.length > 1 ? (
            <div className="relative flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-cyan-400 dark:hover:border-cyan-500 transition-colors group">
              <Building2 className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors shrink-0" />
              <select
                value={selectedTenantId ?? ""}
                onChange={(e) => setSelectedTenantId(e.target.value || null)}
                className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer pr-5 appearance-none"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
            </div>
          ) : selectedTenantName ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
              <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{selectedTenantName}</span>
            </div>
          ) : null}

          <div className="hidden md:flex flex-col items-end">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{formatTime(currentTime)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(currentTime)}</div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>

            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 dark:border-slate-700">
            <div className="hidden md:flex flex-col items-end">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {user?.email?.split("@")[0] || "User"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {selectedTenantName ? `${roleLabel} · ${selectedTenantName}` : roleLabel}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow">
              <User className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
