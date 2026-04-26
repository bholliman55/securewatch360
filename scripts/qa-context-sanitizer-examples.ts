import { sanitizeContextBundle, sanitizeContextItem } from "@/lib/token-optimization/contextSanitizer";
import type { ContextBundle, ContextItem } from "@/lib/token-optimization/types";

function runExamples() {
  const item: ContextItem = {
    key: "authorization_header",
    value: "Bearer super-secret-token",
  };
  const sanitizedItem = sanitizeContextItem(item);
  console.log("Authorization item sanitized:", sanitizedItem.value);

  const bundle: ContextBundle = {
    tenantId: "00000000-0000-0000-0000-000000000000",
    data: {
      severity: "high",
      finding_title: "Publicly exposed admin panel",
      finding_description: "Admin endpoint is internet accessible.",
      raw_scanner_logs: "A".repeat(5000),
      stack_trace: "Error: boom\n at foo\n at bar",
      api_key: "sk_live_123",
      cookie: "session=abc123",
      private_webhook_url: "https://example.com/private/webhook/abcdef",
      remediation_status: "pending",
      control_id: "SOC2-CC6.1",
    },
    items: [
      { key: "target_type", value: "server" },
      { key: "password", value: "dont-send-me" },
    ],
  };

  const sanitizedBundle = sanitizeContextBundle(bundle);
  console.log("Sanitized keys:", Object.keys(sanitizedBundle.data).join(", "));
  console.log("Contains severity:", "severity" in sanitizedBundle.data);
  console.log("Contains raw_scanner_logs:", "raw_scanner_logs" in sanitizedBundle.data);
  console.log("Password item sanitized:", sanitizedBundle.items?.[1]?.value);
}

runExamples();
