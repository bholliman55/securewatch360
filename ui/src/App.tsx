import { useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <TopNav onRefresh={refresh} />
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!meLoading && tenants.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No tenant access</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Your account is signed in, but you are not a member of any organization yet. Ask an administrator to add
            you to a tenant in Supabase (<code className="text-xs">tenant_users</code>).
          </p>
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
