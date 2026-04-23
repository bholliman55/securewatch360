import { monitoringAlertReceived } from "./monitoring-alert-received";
import { scanTenantRequested } from "./scan-tenant";
import { scheduledDailyScans, scheduledWeeklyScans } from "./scheduled-scans";

/**
 * All functions registered in one place so `serve()` stays a one-liner.
 * Add a new file under this folder, export the function, and append here.
 */
export const inngestFunctions = [
  scanTenantRequested,
  monitoringAlertReceived,
  scheduledDailyScans,
  scheduledWeeklyScans,
];
