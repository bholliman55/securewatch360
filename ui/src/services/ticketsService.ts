export interface Ticket {
  ticket_id: string;
  incident_id: string | null;
  client_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

class TicketsService {
  async getTickets(_tenantId?: string | null): Promise<Ticket[]> {
    return [];
  }

  async getTicketsByIncident(_incidentId: string): Promise<Ticket[]> {
    return [];
  }

  async createTicket(_ticket: Partial<Ticket>): Promise<Ticket> {
    throw new Error(
      "Ticketing is not wired to SecureWatch360 APIs yet. Use the main app for approvals and remediation."
    );
  }

  async updateTicket(_ticketId: string, _updates: Partial<Ticket>): Promise<void> {
    /* no-op */
  }

  async deleteTicket(_ticketId: string): Promise<void> {
    /* no-op */
  }
}

export const ticketsService = new TicketsService();
