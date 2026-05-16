export interface InventoryReport {
  collector_id: string;
  tenant_id: string;
  source_type: "site_collector";
  schema_version: "collector.inventory.v1";
  collected_at: string;
  host: Record<string, unknown>;
  network: Record<string, unknown>;
  software: Record<string, unknown>;
  processes: Record<string, unknown>;
  ports: Record<string, unknown>;
  errors: string[];
}
