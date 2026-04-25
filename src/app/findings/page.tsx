import { FindingsClient } from "./findings-client";

export default function FindingsPage() {
  return (
    <main>
      <h1>SecureWatch360 Findings</h1>
      <p>Simple v2 findings view with basic filters and newest-first results.</p>
      <FindingsClient />
    </main>
  );
}
