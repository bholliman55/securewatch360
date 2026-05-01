# Notification digest delivery (email + Slack)

When `NOTIFICATION_DELIVERY_ENABLED=true`, the hourly Inngest job (`notification-digest`) attempts real outbound delivery **after** audit + evidence stubs.

## Email (Resend)

| Variable | Description |
|---------|-------------|
| `NOTIFICATION_DELIVERY_ENABLED` | `true` to enable |
| `RESEND_API_KEY` | Resend API key |
| `NOTIFICATION_EMAIL_FROM` | Verified sender (e.g. `Digest <digest@yourdomain.com>`) |
| `NOTIFICATION_DIGEST_EMAIL_TO` | Comma-separated recipient addresses |

## Slack (Incoming Webhook)

| Variable | Description |
|---------|-------------|
| `SW360_SLACK_DIGEST_WEBHOOK_URL` | Slack app incoming webhook URL |

Rules with `channel=slack` use the webhook; rules with `channel=email` use Resend. `in_app` remains stub-only until a product inbox exists.

If delivery is enabled but provider env is incomplete, attempts are logged in `audit_logs` under `deliveryAttempts` without failing the job.
