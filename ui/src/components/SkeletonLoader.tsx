export function SkeletonMetricCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border-l-4 border-slate-300 dark:border-slate-700 p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonAgentCard() {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-600 rounded" />
            <div className="h-3 w-40 bg-slate-200 dark:bg-slate-600 rounded" />
          </div>
        </div>
        <div className="h-6 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
      </div>
    </div>
  );
}

export function SkeletonAlertCard() {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg animate-pulse">
      <div className="flex items-start justify-between mb-2">
        <div className="h-5 w-16 bg-slate-200 dark:bg-slate-600 rounded" />
        <div className="w-4 h-4 bg-slate-200 dark:bg-slate-600 rounded" />
      </div>
      <div className="h-4 w-full bg-slate-200 dark:bg-slate-600 rounded mb-3" />
      <div className="flex justify-between">
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-600 rounded" />
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
      </div>
    </div>
  );
}

export function SkeletonTimelineItem() {
  return (
    <div className="relative flex items-start space-x-4 animate-pulse">
      <div className="flex-shrink-0 w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
      <div className="flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-600 rounded" />
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-600 rounded" />
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonChartPlaceholder() {
  return (
    <div className="w-full h-80 bg-slate-100 dark:bg-slate-700/50 rounded-lg animate-pulse flex items-center justify-center">
      <div className="text-center">
        <div className="w-32 h-32 bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mb-4" />
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-600 rounded mx-auto" />
      </div>
    </div>
  );
}

export function HeroMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <SkeletonMetricCard key={i} />
      ))}
    </div>
  );
}

export function SystemStatusSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonAgentCard key={i} />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonAlertCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ActivityTimelineSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
      <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-6 animate-pulse" />
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonTimelineItem key={i} />
        ))}
      </div>
    </div>
  );
}
