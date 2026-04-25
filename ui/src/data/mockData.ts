export const heroMetrics = {
  activeThreats: {
    value: 12,
    trend: -8.5,
    label: 'Total Active Threats',
    color: 'red'
  },
  openIncidents: {
    value: 7,
    trend: -12.3,
    label: 'Open Incidents',
    color: 'orange'
  },
  complianceScore: {
    value: 94,
    trend: 2.1,
    label: 'Compliance Score',
    color: 'green'
  },
  trainingCompletion: {
    value: 87,
    trend: 5.4,
    label: 'Training Completion',
    color: 'blue'
  }
};

export const agents = [
  {
    id: 1,
    name: 'Scanner',
    icon: 'Radar',
    status: 'Active',
    lastActivity: '2 minutes ago',
    description: 'Continuous vulnerability scanning'
  },
  {
    id: 2,
    name: 'Monitoring',
    icon: 'Activity',
    status: 'Active',
    lastActivity: '5 minutes ago',
    description: 'Real-time threat monitoring'
  },
  {
    id: 3,
    name: 'Compliance',
    icon: 'ClipboardCheck',
    status: 'Active',
    lastActivity: '10 minutes ago',
    description: 'Regulatory compliance checks'
  },
  {
    id: 4,
    name: 'Training',
    icon: 'GraduationCap',
    status: 'Idle',
    lastActivity: '1 hour ago',
    description: 'Security awareness training'
  },
  {
    id: 5,
    name: 'Incidents',
    icon: 'AlertTriangle',
    status: 'Active',
    lastActivity: '3 minutes ago',
    description: 'Incident response automation'
  }
];

export const recentAlerts = [
  {
    id: 1,
    severity: 'Critical',
    title: 'Unauthorized access attempt detected',
    source: 'Monitoring',
    timestamp: '2 minutes ago'
  },
  {
    id: 2,
    severity: 'High',
    title: 'Multiple failed login attempts from IP 192.168.1.54',
    source: 'Scanner',
    timestamp: '15 minutes ago'
  },
  {
    id: 3,
    severity: 'Medium',
    title: 'Outdated SSL certificate on web-server-03',
    source: 'Compliance',
    timestamp: '1 hour ago'
  },
  {
    id: 4,
    severity: 'High',
    title: 'Suspicious outbound traffic to unknown domain',
    source: 'Monitoring',
    timestamp: '2 hours ago'
  },
  {
    id: 5,
    severity: 'Low',
    title: 'Employee completed phishing training module',
    source: 'Training',
    timestamp: '3 hours ago'
  }
];

export const securityPostureData = [
  { name: 'Critical', value: 3, color: '#ef4444' },
  { name: 'High', value: 9, color: '#f97316' },
  { name: 'Medium', value: 24, color: '#eab308' },
  { name: 'Low', value: 45, color: '#3b82f6' },
  { name: 'No Issues', value: 156, color: '#22c55e' }
];

export const activityTimeline = [
  {
    id: 1,
    timestamp: '2 min ago',
    agent: 'Monitoring',
    agentIcon: 'Activity',
    description: 'Blocked unauthorized access attempt from external IP',
    status: 'Success'
  },
  {
    id: 2,
    timestamp: '5 min ago',
    agent: 'Incidents',
    agentIcon: 'AlertTriangle',
    description: 'Created incident ticket #INC-2847 for investigation',
    status: 'In Progress'
  },
  {
    id: 3,
    timestamp: '12 min ago',
    agent: 'Scanner',
    agentIcon: 'Radar',
    description: 'Completed full network vulnerability scan',
    status: 'Success'
  },
  {
    id: 4,
    timestamp: '25 min ago',
    agent: 'Compliance',
    agentIcon: 'ClipboardCheck',
    description: 'Generated monthly compliance report',
    status: 'Success'
  },
  {
    id: 5,
    timestamp: '45 min ago',
    agent: 'Monitoring',
    agentIcon: 'Activity',
    description: 'Detected anomalous database query patterns',
    status: 'Warning'
  },
  {
    id: 6,
    timestamp: '1 hr ago',
    agent: 'Training',
    agentIcon: 'GraduationCap',
    description: 'Sent security awareness training reminder to 23 users',
    status: 'Success'
  },
  {
    id: 7,
    timestamp: '1.5 hrs ago',
    agent: 'Scanner',
    agentIcon: 'Radar',
    description: 'Identified 2 new CVEs affecting infrastructure',
    status: 'Warning'
  },
  {
    id: 8,
    timestamp: '2 hrs ago',
    agent: 'Incidents',
    agentIcon: 'AlertTriangle',
    description: 'Resolved incident #INC-2841 - False positive alert',
    status: 'Success'
  },
  {
    id: 9,
    timestamp: '3 hrs ago',
    agent: 'Compliance',
    agentIcon: 'ClipboardCheck',
    description: 'Updated firewall rules per security policy',
    status: 'Success'
  },
  {
    id: 10,
    timestamp: '4 hrs ago',
    agent: 'Monitoring',
    agentIcon: 'Activity',
    description: 'System health check completed - All systems nominal',
    status: 'Success'
  }
];
