import { useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { supabase } from "./services/supabaseClient";
import { ErrorBoundary } from "./components/ErrorBoundary";
import TopNav from "./components/TopNav";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { useDashboardData } from "./hooks/useDashboardData";

function AuthenticatedApp() {
  const [activeView, setActiveView] = useState("dashboard");
  const { metrics, alerts, timeline, posture, agents, loading, error, refresh } = useDashboardData(30000);

  return (
    <div className="min-h-screen bg-[var(--sw-bg)] transition-colors duration-200">
      <TopNav onRefresh={refresh} onOpenSettings={() => setActiveView("settings")} />
      <div className="flex h-[calc(100vh-73px)]">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <Dashboard
          activeView={activeView}
          metrics={metrics}
          alerts={alerts}
          timeline={timeline}
          posture={posture}
          agents={agents}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading: authLoading, tenants, meLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--sw-bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1e88e5] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--sw-text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!meLoading && tenants.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--sw-bg)] flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-[var(--sw-border)] bg-[var(--sw-surface)] p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-[var(--sw-text-primary)] mb-2">No organization yet</h1>
          <p className="text-[var(--sw-text-muted)] text-sm mb-6">
            Your account is signed in but not linked to an organization.
            Complete setup to create yours, or ask an administrator to add you.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/onboarding"
              className="block w-full py-2 px-4 rounded-lg font-semibold text-sm text-white bg-[linear-gradient(135deg,#1565c0,#1e88e5)]"
            >
              Complete setup →
            </a>
            <button
              onClick={() => { void supabase.auth.signOut().then(() => { window.location.href = "/login"; }); }}
              className="block w-full py-2 px-4 rounded-lg text-sm text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)] border border-[var(--sw-border)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TenantProvider tenants={tenants} loading={meLoading}>
      <AuthenticatedApp />
    </TenantProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
