import {
  Home,
  Radar,
  Activity,
  ClipboardCheck,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'scanner', label: 'Scanner', icon: Radar },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'compliance', label: 'Compliance', icon: ClipboardCheck },
    { id: 'training', label: 'Training', icon: GraduationCap },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside
      className={`bg-[var(--sw-surface)] border-r border-[var(--sw-border)] transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 py-6 overflow-y-auto">
          <nav className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-[#1565c0] to-[#112d4e] text-white shadow-lg'
                      : 'text-[var(--sw-text-muted)] hover:bg-[var(--sw-surface-elevated)]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''} transition-transform group-hover:scale-110`} />
                  {!collapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[var(--sw-border)]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-[var(--sw-text-muted)]" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-[var(--sw-text-muted)]" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
