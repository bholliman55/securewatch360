import { AlertCircle, AlertTriangle, CheckCircle, GraduationCap, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import VulnerabilitiesListModal from './VulnerabilitiesListModal';

interface HeroMetricsProps {
  metrics: {
    activeThreats: number;
    openIncidents: number;
    complianceScore: number;
    trainingCompletion: number;
  } | null;
}

export default function HeroMetrics({ metrics: data }: HeroMetricsProps) {
  const [animated, setAnimated] = useState(false);
  const [showVulnerabilities, setShowVulnerabilities] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimated(true), 100);
  }, []);

  const metrics = [
    {
      value: data?.activeThreats || 0,
      trend: -8.5,
      label: 'Total Active Threats',
      icon: AlertCircle,
      borderColor: 'border-red-500',
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-500'
    },
    {
      value: data?.openIncidents || 0,
      trend: -12.3,
      label: 'Open Incidents',
      icon: AlertTriangle,
      borderColor: 'border-orange-500',
      bgColor: 'bg-orange-500/10',
      iconColor: 'text-orange-500'
    },
    {
      value: data?.complianceScore || 0,
      trend: 2.1,
      label: 'Compliance Score',
      icon: CheckCircle,
      borderColor: 'border-green-500',
      bgColor: 'bg-green-500/10',
      iconColor: 'text-green-500',
      suffix: '%'
    },
    {
      value: data?.trainingCompletion || 0,
      trend: 5.4,
      label: 'Training Completion',
      icon: GraduationCap,
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      suffix: '%'
    }
  ];

  return (
    <>
      <VulnerabilitiesListModal
        isOpen={showVulnerabilities}
        onClose={() => setShowVulnerabilities(false)}
        filterType="critical"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const isPositive = metric.trend > 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;

        const isClickable = index === 0;
        return (
          <div
            key={index}
            onClick={() => isClickable && setShowVulnerabilities(true)}
            className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg border-l-4 ${metric.borderColor} p-6 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 ${
              animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            } ${isClickable ? 'cursor-pointer' : ''}`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {metric.label}
                </p>
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                    {animated ? metric.value : 0}
                    {metric.suffix && <span className="text-2xl">{metric.suffix}</span>}
                  </h3>
                </div>
                <div className="flex items-center space-x-1 mt-2">
                  <TrendIcon className={`w-4 h-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(metric.trend)}%
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">vs last period</span>
                </div>
              </div>
              <div className={`${metric.bgColor} p-3 rounded-lg`}>
                <Icon className={`w-8 h-8 ${metric.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
