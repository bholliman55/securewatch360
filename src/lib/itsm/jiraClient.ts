const JIRA_BASE = process.env.JIRA_BASE_URL?.replace(/\/$/, "") ?? "";
const JIRA_EMAIL = process.env.JIRA_EMAIL?.trim() ?? "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN?.trim() ?? "";
const JIRA_PROJECT = process.env.JIRA_PROJECT_KEY?.trim() ?? "";

function authHeader(): string {
  const cred = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${cred}`;
}

export function isJiraConfigured(): boolean {
  return Boolean(JIRA_BASE && JIRA_EMAIL && JIRA_API_TOKEN && JIRA_PROJECT);
}

export type CreateJiraIssueInput = {
  summary: string;
  description?: string;
  issueType?: string;
};

export type JiraCreateResult = {
  issueKey: string;
  selfUrl: string;
};

/**
 * Jira Software Cloud: REST v3 (issue create).
 * See https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */
export async function createJiraIssue(input: CreateJiraIssueInput): Promise<JiraCreateResult> {
  if (!isJiraConfigured()) {
    throw new Error("Jira is not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY)");
  }
  const url = `${JIRA_BASE}/rest/api/3/issue`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: authHeader(),
    },
    body: JSON.stringify({
      fields: {
        project: { key: JIRA_PROJECT },
        summary: input.summary,
        issuetype: { name: input.issueType ?? "Task" },
        ...(input.description
          ? {
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: input.description }],
                  },
                ],
              },
            }
          : {}),
      },
    }),
  });

  const text = await res.text();
  let body: { key?: string; self?: string; errorMessages?: string[]; errors?: Record<string, string> } = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = body.errorMessages?.join("; ") || JSON.stringify(body.errors) || text;
    throw new Error(`Jira create failed: ${res.status} ${msg}`);
  }
  if (!body.key) {
    throw new Error("Jira create: missing key in response");
  }

  return { issueKey: body.key, selfUrl: body.self ?? "" };
}
