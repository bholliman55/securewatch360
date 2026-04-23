import { Buffer } from "node:buffer";

export type ConnectWisePriorityKey = "low" | "medium" | "high" | "critical";

type ConnectWiseConfig = {
  baseUrl: string;
  authHeader: string;
  clientId: string;
  serviceCompanyId: number;
  boardId: number;
  statusId: number;
  priorityBySeverity: Record<ConnectWisePriorityKey, number>;
};

function readEnvInt(name: string, fallback?: number): number | null {
  const v = process.env[name]?.trim();
  if (v === undefined || v.length === 0) return fallback ?? null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getConnectWiseConfig(): ConnectWiseConfig | null {
  const baseUrl = process.env.CONNECTWISE_BASE_URL?.replace(/\/+$/, "") ?? "";
  const company = process.env.CONNECTWISE_COMPANY_ID?.trim() ?? "";
  const publicKey = process.env.CONNECTWISE_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.CONNECTWISE_PRIVATE_KEY?.trim() ?? "";
  const clientId = process.env.CONNECTWISE_CLIENT_ID?.trim() ?? "securewatch360";
  const serviceCompanyId = readEnvInt("CONNECTWISE_SERVICE_COMPANY_ID");
  const boardId = readEnvInt("CONNECTWISE_BOARD_ID");
  const statusId = readEnvInt("CONNECTWISE_STATUS_ID");
  const defaultPrio = readEnvInt("CONNECTWISE_DEFAULT_PRIORITY_ID");

  if (!baseUrl || !company || !publicKey || !privateKey) {
    return null;
  }
  if (serviceCompanyId == null || boardId == null || statusId == null) {
    return null;
  }

  const creds = `${company}+${publicKey}:${privateKey}`;
  const authHeader = `Basic ${Buffer.from(creds, "utf8").toString("base64")}`;

  const pickPrio = (k: string, d: number | null): number | null => {
    return readEnvInt(k) ?? d;
  };

  const critical = pickPrio("CONNECTWISE_PRIORITY_CRITICAL", defaultPrio);
  const high = pickPrio("CONNECTWISE_PRIORITY_HIGH", defaultPrio);
  const medium = pickPrio("CONNECTWISE_PRIORITY_MEDIUM", defaultPrio);
  const low = pickPrio("CONNECTWISE_PRIORITY_LOW", defaultPrio);

  if (
    critical == null ||
    high == null ||
    medium == null ||
    low == null ||
    critical < 1 ||
    high < 1 ||
    medium < 1 ||
    low < 1
  ) {
    return null;
  }

  return {
    baseUrl,
    authHeader,
    clientId,
    serviceCompanyId,
    boardId,
    statusId,
    priorityBySeverity: {
      critical,
      high,
      medium,
      low,
    },
  };
}

export function isConnectWiseConfigured(): boolean {
  return getConnectWiseConfig() !== null;
}

function cwJsonHeaders(config: ConnectWiseConfig): Record<string, string> {
  return {
    Authorization: config.authHeader,
    clientId: config.clientId,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function parseCwErrorMessage(res: Response, body: string): Promise<string> {
  let msg = res.statusText || "ConnectWise request failed";
  if (!body) return msg;
  try {
    const j = JSON.parse(body) as { message?: string; error?: string; code?: string };
    if (j.message) msg = j.message;
    else if (j.error) msg = j.error;
  } catch {
    if (body.length < 2000) msg = body;
  }
  return msg;
}

type CreateTicketInput = {
  summary: string;
  initialDescription: string;
  priority: ConnectWisePriorityKey;
};

export type ConnectWiseCreatedTicket = { id: number; summary: string; board?: unknown; status?: unknown };

export async function createConnectWiseServiceTicket(
  input: CreateTicketInput
): Promise<ConnectWiseCreatedTicket> {
  const config = getConnectWiseConfig();
  if (!config) {
    throw new Error("ConnectWise is not configured (missing or invalid environment variables).");
  }

  const priorityId = config.priorityBySeverity[input.priority] ?? config.priorityBySeverity.medium;
  const url = `${config.baseUrl}/service/tickets/ServiceTicket`;
  const body = {
    summary: input.summary,
    initialDescription: input.initialDescription,
    company: { id: config.serviceCompanyId },
    board: { id: config.boardId },
    status: { id: config.statusId },
    priority: { id: priorityId },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: cwJsonHeaders(config),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(await parseCwErrorMessage(res, text));
  }

  const data = (text.length > 0 ? (JSON.parse(text) as ConnectWiseCreatedTicket) : { id: 0, summary: input.summary });
  if (!data.id) {
    throw new Error("ConnectWise returned a ticket with no id.");
  }
  return data;
}

type CwTicketListItem = {
  id: number;
  summary: string;
  dateEntered: string;
  status?: { name?: string } | null;
  priority?: { name?: string } | null;
};

/**
 * Fetches a page of service tickets, preferring a company filter. Retries without
 * a company filter if the API rejects the query (varies by ConnectWise site and permissions).
 */
export async function listConnectWiseServiceTickets(pageSize: number = 20): Promise<CwTicketListItem[]> {
  const config = getConnectWiseConfig();
  if (!config) {
    return [];
  }

  const makeUrl = (conditions: string | null) => {
    const params = new URLSearchParams();
    params.set("orderBy", "dateEntered desc");
    params.set("page", "1");
    params.set("pageSize", String(Math.min(100, Math.max(1, pageSize))));
    if (conditions) params.set("conditions", conditions);
    return `${config.baseUrl}/service/tickets/ServiceTicket?${params.toString()}`;
  };

  const run = async (url: string) => {
    const res = await fetch(url, { headers: { Authorization: config.authHeader, clientId: config.clientId, Accept: "application/json" } });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false as const, err: await parseCwErrorMessage(res, text) };
    }
    const j = (text.length > 0 ? JSON.parse(text) : null) as CwTicketListItem[] | { data?: CwTicketListItem[] } | null;
    const list = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []);
    return { ok: true as const, list };
  };

  const companyId = String(config.serviceCompanyId);
  const withCompany = `company/id = ${companyId}`;
  const first = await run(makeUrl(withCompany));
  if (first.ok) {
    return first.list;
  }
  const second = await run(makeUrl(null));
  return second.ok ? second.list : [];
}
