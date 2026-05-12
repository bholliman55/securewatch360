import { createConnectWiseSocStub } from "./connectWiseAdapter.stub";
import { createJiraSocStub } from "./jiraAdapter.stub";
import { MockSocAdapter } from "./mockSocAdapter";
import type { SocIntegrationAdapter, SocIntegrationProvider } from "./socIntegration.interface";
import { SOC_INTEGRATION_PROVIDERS } from "./socIntegration.interface";
import { createTeamsSocStub } from "./teamsAdapter.stub";

const defaultFactories: Record<SocIntegrationProvider, () => SocIntegrationAdapter> = {
  connectwise_psa: createConnectWiseSocStub,
  halopsa: () => new MockSocAdapter("halopsa"),
  autotask: () => new MockSocAdapter("autotask"),
  jira: createJiraSocStub,
  servicenow: () => new MockSocAdapter("servicenow"),
  pagerduty: () => new MockSocAdapter("pagerduty"),
  slack: () => new MockSocAdapter("slack"),
  microsoft_teams: createTeamsSocStub,
  email: () => new MockSocAdapter("email"),
};

/**
 * Resolves SOC integration adapters. Callers supply tenant-scoped configuration at the API / workflow layer;
 * this registry only wires provider → adapter implementation (stubs and mocks by default).
 */
export class SocIntegrationRegistry {
  private readonly factories: Map<SocIntegrationProvider, () => SocIntegrationAdapter> = new Map();

  constructor(seed: Partial<Record<SocIntegrationProvider, () => SocIntegrationAdapter>> = {}) {
    for (const p of SOC_INTEGRATION_PROVIDERS) {
      this.factories.set(p, seed[p] ?? defaultFactories[p]);
    }
  }

  register(provider: SocIntegrationProvider, factory: () => SocIntegrationAdapter): void {
    this.factories.set(provider, factory);
  }

  createAdapter(provider: SocIntegrationProvider): SocIntegrationAdapter {
    const f = this.factories.get(provider);
    if (!f) {
      throw new Error(`unknown_soc_provider:${provider}`);
    }
    return f();
  }

  listProviders(): SocIntegrationProvider[] {
    return [...SOC_INTEGRATION_PROVIDERS];
  }
}

export function createDefaultSocIntegrationRegistry(): SocIntegrationRegistry {
  return new SocIntegrationRegistry();
}
