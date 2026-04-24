# ITSM integrations: ConnectWise, Jira, and ServiceNow

## ConnectWise Manage (existing)

- `GET/POST` `/api/integrations/connectwise/tickets` with `tenantId` and ConnectWise env vars. See `src/lib/connectwise.ts`.

## Jira Cloud

1. In Atlassian, create an API token for a bot user. Grant access to a project.
2. Set in `.env` / host secrets (never commit values):

| Variable | Example |
|----------|---------|
| `JIRA_BASE_URL` | `https://yourorg.atlassian.net` |
| `JIRA_EMAIL` | bot service account |
| `JIRA_API_TOKEN` | token |
| `JIRA_PROJECT_KEY` | `SEC` (short project key) |

3. **Test:** `GET /api/integrations/jira/issues` → `{ configured: true }` when all vars are set.
4. **Create from SecureWatch360:** `POST` same path with JSON `{ "tenantId": "…", "summary": "…", "description": "…" }` (session user must be analyst+ on tenant).

## ServiceNow (Incident table)

1. Create an integration user with `incident` create rights (scoped app or legacy ACLs per your org).
2. Set:

| Variable | Example |
|----------|---------|
| `SERVICENOW_INSTANCE` | `myorg.service-now.com` (host only, or full https URL) |
| `SERVICENOW_USER` | user id |
| `SERVICENOW_PASSWORD` | password (prefer credential vault) |

3. `GET /api/integrations/servicenow/incidents` for configuration probe.
4. `POST` with `{ "tenantId", "shortDescription", "description?" }` to open an incident.

**Security:** all three integrations run server-side; credentials are not exposed to the browser. Audit events `itsm.jira.issue_created` and `itsm.servicenow.incident_created` are written with `entityType=system` for traceability.
