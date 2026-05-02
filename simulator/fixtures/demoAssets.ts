/**
 * Inventoried-but-fictional endpoints for demo simulations.
 * Hostnames terminate under RFC 6761 `.invalid` — not routable on the public Internet.
 */

import type { DemoClientFixture } from "./demoClients";

export interface DemoAssetFixture {
  id: string;
  /** Owning demo client's surrogate tenant UUID */
  demo_client_id: string;
  asset_category: "workstation" | "server" | "cloud_workload" | "network_edge" | "identity_plane";
  hostname: string;
  /** Decorative — not correlated to real subnets. */
  faux_network_zone: string;
  business_role_stub: string;
}

/** Curated anchors per fictional client — used to enrich stamped payloads during demo runs. */
export const DEMO_ASSET_FIXTURES: readonly DemoAssetFixture[] = [
  {
    id: "da-acme-edge-erp-01",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa001",
    asset_category: "server",
    hostname: "erp-gw-edge-01.manufacturing.acme.sw360-demo.invalid",
    faux_network_zone: "OT-adjacency DMZ (simulated VLAN tag 4093)",
    business_role_stub: "Tier-1 quoting & planning ERP edge — demo breach narrative only.",
  },
  {
    id: "da-acme-wks-mes-42",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa001",
    asset_category: "workstation",
    hostname: "mes-floor-wks42.plant7.acme.sw360-demo.invalid",
    faux_network_zone: "Factory floor segmented wireless (lab storyboard)",
    business_role_stub: "MES engineer jump host — kiosk-style privilege model.",
  },
  {
    id: "da-vhg-ehr-edge",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa002",
    asset_category: "cloud_workload",
    hostname: "ehr-integration-stub.volunteerhealth.sw360-demo.invalid",
    faux_network_zone: "HITRUST-flavored VPC slice (conceptual labeling only)",
    business_role_stub: "FHIR façade integration VM — synthetic traffic descriptors only.",
  },
  {
    id: "da-vhg-clinic-wifi",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa002",
    asset_category: "network_edge",
    hostname: "wifi-controller.clinic.ring3.volunteerhealth.sw360-demo.invalid",
    faux_network_zone: "Guest-care SSID segregation (diagram-only)",
    business_role_stub: "Clinic guest Wi-Fi posture review anchor.",
  },
  {
    id: "da-cds-scm-jump",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa003",
    asset_category: "workstation",
    hostname: "scm-jump.cage5.chattdefense.sw360-demo.invalid",
    faux_network_zone: "CUI-scoped VLAN (labels only — zero regulated payloads)",
    business_role_stub: "Supply-chain analyst privileged jump box.",
  },
  {
    id: "da-cds-manifest-api",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa003",
    asset_category: "server",
    hostname: "manifest-api-east.chattdefense.sw360-demo.invalid",
    faux_network_zone: "Dual-stack perimeter segment (diagram stub)",
    business_role_stub: "Export manifest JSON gateway — sanitized fixture responses only.",
  },
  {
    id: "da-rdp-cc-terminal",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa004",
    asset_category: "workstation",
    hostname: "frontdesk-cc01.apex.riverbend-dental.sw360-demo.invalid",
    faux_network_zone: "PCI-scoped VLAN (tokenization assumed in narrative)",
    business_role_stub: "Front-desk checkout terminal — swipe metadata synthetic only.",
  },
  {
    id: "da-rdp-sharepoint-lite",
    demo_client_id: "b2c7d5e9-6014-5a8b-bc11-ffffffffa004",
    asset_category: "cloud_workload",
    hostname: "clinic-collab-lite.riverbend-dental.sw360-demo.invalid",
    faux_network_zone: "M365-aligned collaboration slice (SKU labels illustrative)",
    business_role_stub: "Policy-sync lab for phishing / awareness drillbacks.",
  },
] as const;

export function demoAssetsForClient(demo_client_id: string): DemoAssetFixture[] {
  return DEMO_ASSET_FIXTURES.filter((a) => a.demo_client_id === demo_client_id);
}

/** Primary billboard asset for payloads that need one labeled host anchor. */
export function primaryDemoAssetForClient(client: DemoClientFixture): DemoAssetFixture {
  const mine = demoAssetsForClient(client.id);
  return mine[0] ?? FALLBACK_STUB_ASSET(client);
}

function FALLBACK_STUB_ASSET(client: DemoClientFixture): DemoAssetFixture {
  return {
    id: "da-generic-stub",
    demo_client_id: client.id,
    asset_category: "server",
    hostname: `placeholder.${client.slug}.sw360-demo.invalid`,
    faux_network_zone: "Generic lab segment",
    business_role_stub: "Synthetic posture anchor.",
  };
}
