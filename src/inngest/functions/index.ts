import { monitoringAlertReceived } from "./monitoring-alert-received";
import { postRemediationRevalidationRequested } from "./post-remediation-revalidation";
import { remediationExecutionRequested } from "./remediation-execution-requested";
import { scanTenantRequested } from "./scan-tenant";
import { scheduledDailyScans, scheduledWeeklyScans } from "./scheduled-scans";
import { awarenessSignalsRefresh } from "./awareness-signals-refresh";
import { approvalRiskSlaSweep } from "./approval-risk-sla-sweep";
import { compliancePostureDaily } from "./compliance-posture-daily";
import { notificationDigest } from "./notification-digest";
import { runExternalDiscovery } from "./runExternalDiscovery";
import { runOsintCollectionFunction } from "./runOsintCollection";
import { runComplianceStatusFunction } from "./runComplianceStatus";
import { runRiskQueryFunction } from "./runRiskQuery";
import { runAlertSummaryFunction } from "./runAlertSummary";
import { runVendorRiskAssessmentFunction } from "./runVendorRiskAssessment";
import { generateRemediationPlaybookFunction } from "./generateRemediationPlaybook";

export const inngestFunctions = [
  scanTenantRequested,
  remediationExecutionRequested,
  postRemediationRevalidationRequested,
  monitoringAlertReceived,
  scheduledDailyScans,
  scheduledWeeklyScans,
  awarenessSignalsRefresh,
  approvalRiskSlaSweep,
  compliancePostureDaily,
  notificationDigest,
  runExternalDiscovery,
  runOsintCollectionFunction,
  runComplianceStatusFunction,
  runRiskQueryFunction,
  runAlertSummaryFunction,
  runVendorRiskAssessmentFunction,
  generateRemediationPlaybookFunction,
];
