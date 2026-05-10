/**
 * Zod schemas for ticket lifecycle payloads sent to PSA / ITSM systems.
 */

import { z } from "zod";

export const ticketPrioritySchema = z.enum(["p4", "p3", "p2", "p1", "p0"]);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketCorrelationSchema = z.object({
  simulation_run_id: z.string().min(1).optional(),
  incident_id: z.string().min(1).optional(),
});

export type TicketCorrelation = z.infer<typeof ticketCorrelationSchema>;

export const createTicketSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(32000),
  priority: ticketPrioritySchema,
  requester_email: z.string().email().optional(),
  tags: z.array(z.string()).default([]),
  /** Link to SecureWatch360 simulation or incident records (stored as vendor custom fields / description footers). */
  correlation: ticketCorrelationSchema.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  tenant_id: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(32000).optional(),
  priority: ticketPrioritySchema.optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const addEvidenceSchema = z.object({
  tenant_id: z.string().uuid(),
  label: z.string().min(1).max(500),
  /** Public HTTPS URL to evidence bundle or export (preferred for PSAs). */
  evidence_url: z.string().url().optional(),
  /** Opaque reference to an internal evidence record — adapters map to vendor fields. */
  evidence_record_id: z.string().min(1).optional(),
  summary: z.string().max(8000).optional(),
  captured_at: z.string().datetime().optional(),
});

export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;

export const closeTicketSchema = z.object({
  tenant_id: z.string().uuid(),
  resolution_notes: z.string().min(1).max(16000),
  resolution_code: z.string().max(64).optional(),
});

export type CloseTicketInput = z.infer<typeof closeTicketSchema>;

export const escalateTicketSchema = z.object({
  tenant_id: z.string().uuid(),
  reason: z.string().min(1).max(4000),
  target_queue_or_team: z.string().max(256).optional(),
  new_priority: ticketPrioritySchema.optional(),
});

export type EscalateTicketInput = z.infer<typeof escalateTicketSchema>;

export const linkTicketCorrelationSchema = z.object({
  tenant_id: z.string().uuid(),
  correlation: ticketCorrelationSchema,
});

export type LinkTicketCorrelationInput = z.infer<typeof linkTicketCorrelationSchema>;
