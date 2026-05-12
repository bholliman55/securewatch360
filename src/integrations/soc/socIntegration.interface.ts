/**
 * SOC / ITSM workflow adapter contract — implementations use stubs or tenant-scoped credentials;
 * never embed real API secrets in code.
 */

import type {
  AddEvidenceInput,
  CloseTicketInput,
  CreateTicketInput,
  EscalateTicketInput,
  LinkTicketCorrelationInput,
  UpdateTicketInput,
} from "./ticketPayload.schema";
import type { NotifyChannelInput } from "./notificationPayload.schema";

export const SOC_INTEGRATION_PROVIDERS = [
  "connectwise_psa",
  "halopsa",
  "autotask",
  "jira",
  "servicenow",
  "pagerduty",
  "slack",
  "microsoft_teams",
  "email",
] as const;

export type SocIntegrationProvider = (typeof SOC_INTEGRATION_PROVIDERS)[number];

export type SocTicketReference = {
  provider: SocIntegrationProvider;
  external_ticket_id: string;
  ticket_url?: string;
};

export type SocOperationResult<T = Record<string, unknown>> = {
  ok: boolean;
  provider: SocIntegrationProvider;
  data?: T;
  error?: string;
};

/**
 * Pluggable SOC / PSA / chat integration. Real HTTP clients should wrap these methods
 * with retries, redacted logging, and `requireTenantAccess`-aligned callers.
 */
export interface SocIntegrationAdapter {
  readonly provider: SocIntegrationProvider;

  createTicket(input: CreateTicketInput): Promise<SocOperationResult<SocTicketReference>>;

  updateTicket(ticketId: string, input: UpdateTicketInput): Promise<SocOperationResult>;

  addEvidence(
    ticketId: string,
    input: AddEvidenceInput,
  ): Promise<SocOperationResult<{ evidence_id: string }>>;

  closeTicket(ticketId: string, input: CloseTicketInput): Promise<SocOperationResult>;

  escalateTicket(ticketId: string, input: EscalateTicketInput): Promise<SocOperationResult>;

  notifyChannel(input: NotifyChannelInput): Promise<SocOperationResult<{ notification_id: string }>>;

  /** Attach or refresh vendor custom fields linking the external ticket to SW360 entities. */
  linkTicket(ticketId: string, input: LinkTicketCorrelationInput): Promise<SocOperationResult>;
}
