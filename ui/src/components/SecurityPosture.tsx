import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface SecurityPostureProps {
  data: Array<{ name: string; value: number; color: string }>;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

interface CustomLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

export default function SecurityPosture({ data: securityPostureData }: SecurityPostureProps) {
  const total = securityPostureData && securityPostureData.length > 0
    ? securityPostureData.reduce((acc, item) => acc + item.value, 0)
    : 0;

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-[var(--sw-surface)] p-3 rounded-lg shadow-lg border border-[var(--sw-border)]">
          <p className="font-semibold text-[var(--sw-text-primary)]">
            {data.name}
          </p>
          <p className="text-sm text-[var(--sw-text-muted)]">
            Count: {data.value}
          </p>
          <p className="text-sm text-[var(--sw-text-muted)]">
            Percentage: {((data.value / total) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent
  }: CustomLabelProps) => {
    if (
      cx === undefined ||
      cy === undefined ||
      midAngle === undefined ||
      innerRadius === undefined ||
      outerRadius === undefined ||
      percent === undefined
    ) {
      return null;
    }
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (!securityPostureData || securityPostureData.length === 0 || total === 0) {
    return (
      <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)] p-6">
        <h3 className="text-lg font-bold text-[var(--sw-text-primary)] mb-6">
          Security Posture Overview
        </h3>
        <p className="text-[var(--sw-text-muted)] text-center py-8">
          No security posture data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)] p-6">
      <h3 className="text-lg font-bold text-[var(--sw-text-primary)] mb-6">
        Security Posture Overview
      </h3>
      <div className="flex flex-col lg:flex-row items-center justify-around">
        <div className="w-full lg:w-1/2 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={securityPostureData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={120}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
              >
                {securityPostureData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center -mt-16">
            <div className="text-4xl font-bold text-[var(--sw-text-primary)]">
              {total}
            </div>
            <div className="text-sm text-[var(--sw-text-muted)]">
              Total Items
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 space-y-3 mt-8 lg:mt-0">
          {securityPostureData.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-[var(--sw-surface-elevated)] rounded-lg hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-[var(--sw-text-primary)]">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-2xl font-bold text-[var(--sw-text-primary)]">
                  {item.value}
                </span>
                <span className="text-sm text-[var(--sw-text-muted)] w-16 text-right">
                  {((item.value / total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
