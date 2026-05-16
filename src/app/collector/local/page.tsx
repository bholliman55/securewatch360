import LocalCollectorDashboard from "@/components/collector/LocalCollectorDashboard";

export default function LocalCollectorPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
            SecureWatch360 collector
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
            Local Collector Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Review the latest local inventory report from the Windows site collector without
            cloud registration or endpoint deployment.
          </p>
        </div>

        <LocalCollectorDashboard />
      </div>
    </main>
  );
}
