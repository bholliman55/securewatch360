import { randomUUID } from "node:crypto";
import type {
  SocIntegrationAdapter,
  SocIntegrationProvider,
  SocOperationResult,
  SocTicketReference,
} from "./socIntegration.interface";
import { addEvidenceSchema, closeTicketSchema, createTicketSchema, escalateTicketSchema, linkTicketCorrelationSchema, updateTicketSchema } from "./ticketPayload.schema";
import { notifyChannelSchema } from "./notificationPayload.schema";

type StoredTicket = {
  id: string;
  correlation?: { simulation_run_id?: string; incident_id?: string };
  evidence: { evidence_id: string; label: string }[];
};

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/**
 * In-memory SOC adapter for local tests and demos — no outbound HTTP.
 */
export class MockSocAdapter implements SocIntegrationAdapter {
  readonly provider: SocIntegrationProvider;

  private readonly tickets = new Map<string, StoredTicket>();

  constructor(provider: SocIntegrationProvider) {
    this.provider = provider;
  }

  async createTicket(
    input: import("./ticketPayload.schema").CreateTicketInput,
  ): Promise<SocOperationResult<SocTicketReference>> {
    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    const id = newId("ticket");
    this.tickets.set(id, {
      id,
      correlation: parsed.data.correlation,
      evidence: [],
    });
    const ref: SocTicketReference = {
      provider: this.provider,
      external_ticket_id: id,
      ticket_url: `https://mock-soc.local/${this.provider}/tickets/${id}`,
    };
    return { ok: true, provider: this.provider, data: ref };
  }

  async updateTicket(
    ticketId: string,
    input: import("./ticketPayload.schema").UpdateTicketInput,
  ): Promise<SocOperationResult> {
    const parsed = updateTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    if (!this.tickets.has(ticketId)) {
      return { ok: false, provider: this.provider, error: "ticket_not_found" };
    }
    return { ok: true, provider: this.provider, data: { updated: true } };
  }

  async addEvidence(
    ticketId: string,
    input: import("./ticketPayload.schema").AddEvidenceInput,
  ): Promise<SocOperationResult<{ evidence_id: string }>> {
    const parsed = addEvidenceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    const t = this.tickets.get(ticketId);
    if (!t) {
      return { ok: false, provider: this.provider, error: "ticket_not_found" };
    }
    const evidence_id = newId("evidence");
    t.evidence.push({ evidence_id, label: parsed.data.label });
    return { ok: true, provider: this.provider, data: { evidence_id } };
  }

  async closeTicket(
    ticketId: string,
    input: import("./ticketPayload.schema").CloseTicketInput,
  ): Promise<SocOperationResult> {
    const parsed = closeTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    if (!this.tickets.has(ticketId)) {
      return { ok: false, provider: this.provider, error: "ticket_not_found" };
    }
    return { ok: true, provider: this.provider, data: { closed: true } };
  }

  async escalateTicket(
    ticketId: string,
    input: import("./ticketPayload.schema").EscalateTicketInput,
  ): Promise<SocOperationResult> {
    const parsed = escalateTicketSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    if (!this.tickets.has(ticketId)) {
      return { ok: false, provider: this.provider, error: "ticket_not_found" };
    }
    return { ok: true, provider: this.provider, data: { escalated: true } };
  }

  async notifyChannel(
    input: import("./notificationPayload.schema").NotifyChannelInput,
  ): Promise<SocOperationResult<{ notification_id: string }>> {
    const parsed = notifyChannelSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    return {
      ok: true,
      provider: this.provider,
      data: { notification_id: newId("notify") },
    };
  }

  async linkTicket(
    ticketId: string,
    input: import("./ticketPayload.schema").LinkTicketCorrelationInput,
  ): Promise<SocOperationResult> {
    const parsed = linkTicketCorrelationSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, provider: this.provider, error: parsed.error.message };
    }
    const t = this.tickets.get(ticketId);
    if (!t) {
      return { ok: false, provider: this.provider, error: "ticket_not_found" };
    }
    t.correlation = { ...t.correlation, ...parsed.data.correlation };
    return { ok: true, provider: this.provider, data: { linked: true, correlation: t.correlation } };
  }

  /** Test helper — not part of SocIntegrationAdapter. */
  getTicket(ticketId: string): StoredTicket | undefined {
    return this.tickets.get(ticketId);
  }

  clearForTests(): void {
    this.tickets.clear();
  }
}
