import { scannerService } from './scannerService';
import { monitoringService } from './monitoringService';
import { complianceService } from './complianceService';
import { trainingService } from './trainingService';
import { incidentsService } from './incidentsService';

export interface DashboardMetrics {
  activeThreats: number;
  openIncidents: number;
  complianceScore: number;
  trainingCompletion: number;
  lastUpdated: string;
}

export interface Alert {
  id: string;
  severity: string;
  title: string;
  source: string;
  timestamp: string;
  description: string;
  vulnerability_id?: string;
}

export interface Activity {
  id: string;
  timestamp: string;
  agent: string;
  agentIcon: string;
  description: string;
  status: string;
  vulnerability?: {
    vulnerability_id?: string;
    title: string;
    severity: string;
    description?: string | null;
    status?: string;
    discovered_date?: string | null;
    cve_id?: string | null;
    cvss_score?: number | null;
    affected_asset?: string;
    asset_id?: number;
    remediation_steps?: string | null;
    package_name?: string | null;
    package_version?: string | null;
  } | null;
}

export interface SecurityPostureData {
  name: string;
  value: number;
  color: string;
}

export interface AgentStatus {
  id: number;
  name: string;
  status: string;
  lastActivity: string;
}

class DashboardService {
  async getDashboardMetrics(tenantId?: string | null): Promise<DashboardMetrics> {
    try {
      const [scannerMetrics, incidentsMetrics, complianceMetrics, trainingMetrics] = await Promise.all([
        scannerService.getMetrics(tenantId).catch(() => null),
        incidentsService.getMetrics(tenantId).catch(() => null),
        complianceService.getMetrics(tenantId).catch(() => null),
        trainingService.getMetrics(tenantId).catch(() => null)
      ]);

      const activeThreats = scannerMetrics?.criticalVulnerabilities || 0;
      const openIncidents = incidentsMetrics?.open || 0;
      const complianceScore = complianceMetrics?.overallScore || 0;
      const trainingCompletion = trainingMetrics?.avgCompletionRate || 0;

      return {
        activeThreats,
        openIncidents,
        complianceScore: Math.min(Math.round(complianceScore), 100),
        trainingCompletion: Math.min(Math.round(trainingCompletion), 100),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }

  async getRecentAlerts(limit = 10, tenantId?: string | null): Promise<Alert[]> {
    try {
      const vulnerabilities = await scannerService.getAllVulnerabilities(limit, tenantId);

      return vulnerabilities.map(v => ({
        id: String(v.vulnerability_id),
        vulnerability_id: String(v.vulnerability_id),
        severity: v.severity ? v.severity.charAt(0).toUpperCase() + v.severity.slice(1) : 'Unknown',
        title: v.title,
        source: 'Scanner',
        timestamp: v.discovered_date || new Date().toISOString(),
        description: v.description || ''
      }));
    } catch (error) {
      console.error('Error fetching recent alerts:', error);
      return [];
    }
  }

  async getActivityTimeline(limit = 20, tenantId?: string | null): Promise<Activity[]> {
    try {
      const [vulnerabilities, incidents, audits] = await Promise.all([
        scannerService.getAllVulnerabilities(Math.ceil(limit / 3), tenantId).catch(() => []),
        incidentsService.getIncidents(tenantId).catch(() => []),
        complianceService.getAudits(tenantId).catch(() => [])
      ]);

      const activities: Activity[] = [
        ...vulnerabilities.slice(0, Math.ceil(limit / 3)).map(v => ({
          id: `vuln-${String(v.vulnerability_id)}`,
          timestamp: v.discovered_date || new Date().toISOString(),
          agent: 'Scanner',
          agentIcon: 'Shield',
          description: `${v.severity ? v.severity.charAt(0).toUpperCase() + v.severity.slice(1) : 'Unknown'} vulnerability detected: ${v.title}`,
          status: v.severity?.toLowerCase() === 'critical' ? 'Warning' : 'Success',
          vulnerability: {
            vulnerability_id: v.vulnerability_id,
            title: v.title,
            severity: v.severity,
            description: v.description,
            status: v.status,
            discovered_date: v.discovered_date,
            cve_id: v.cve_id,
            cvss_score: v.cvss_score,
            asset_id: v.asset_id,
            remediation_steps: v.remediation_steps,
            package_name: v.package_name,
            package_version: v.package_version
          }
        })),
        ...incidents.slice(0, Math.ceil(limit / 3)).map(i => ({
          id: `incident-${i.incident_id}`,
          timestamp: i.detected_at,
          agent: 'Incidents',
          agentIcon: 'AlertTriangle',
          description: i.title,
          status: i.status === 'open' ? 'In Progress' : 'Success'
        })),
        ...audits.slice(0, Math.ceil(limit / 3)).map(a => ({
          id: `audit-${a.id}`,
          timestamp: a.last_audit,
          agent: 'Compliance',
          agentIcon: 'ClipboardCheck',
          description: `${a.framework} - ${a.requirement}`,
          status: a.status === 'compliant' ? 'Success' : 'In Progress'
        }))
      ];

      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching activity timeline:', error);
      return [];
    }
  }

  async getSecurityPosture(tenantId?: string | null): Promise<SecurityPostureData[]> {
    try {
      const severityDistribution = await scannerService.getSeverityDistribution(tenantId);
      return severityDistribution;
    } catch (error) {
      console.error('Error fetching security posture:', error);
      return [];
    }
  }

  async getAgentStatus(tenantId?: string | null): Promise<AgentStatus[]> {
    try {
      const [recentScans, checks, audits, modules, incidents] = await Promise.all([
        scannerService.getRecentScans(1, tenantId).catch(() => []),
        monitoringService.getChecks(tenantId).catch(() => []),
        complianceService.getAudits(tenantId).catch(() => []),
        trainingService.getModules(tenantId).catch(() => []),
        incidentsService.getIncidents(tenantId).catch(() => [])
      ]);

      return [
        {
          id: 1,
          name: 'Scanner',
          status: recentScans.length > 0 && recentScans[0].status === 'running' ? 'Active' : 'Idle',
          lastActivity: recentScans[0]?.created_at || new Date().toISOString()
        },
        {
          id: 2,
          name: 'Monitoring',
          status: checks.length > 0 ? 'Active' : 'Idle',
          lastActivity: checks[0]?.last_check || new Date().toISOString()
        },
        {
          id: 3,
          name: 'Compliance',
          status: audits.length > 0 ? 'Active' : 'Idle',
          lastActivity: audits[0]?.last_audit || new Date().toISOString()
        },
        {
          id: 4,
          name: 'Training',
          status: modules.length > 0 && modules.filter(m => m.status === 'active').length > 0 ? 'Active' : 'Idle',
          lastActivity: modules[0]?.updated_at || new Date().toISOString()
        },
        {
          id: 5,
          name: 'Incidents',
          status: incidents.length > 0 && incidents.filter(i => i.status === 'open').length > 0 ? 'Active' : 'Idle',
          lastActivity: incidents[0]?.detected_at || new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching agent status:', error);
      return [];
    }
  }
}

export const dashboardService = new DashboardService();
