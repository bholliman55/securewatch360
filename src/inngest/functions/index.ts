import { scanTenantRequested } from "./scan-tenant";

/**
 * All functions registered in one place so `serve()` stays a one-liner.
 * Add a new file under this folder, export the function, and append here.
 */
export const inngestFunctions = [scanTenantRequested];
