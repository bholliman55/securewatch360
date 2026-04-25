import { Inngest } from "inngest";

/**
 * Single Inngest "app" for this deployable. The `id` must be stable; it
 * identifies your app in the Inngest Cloud dashboard and the Dev Server.
 *
 * Send events: `inngest.send({ name: "securewatch/...", data: { ... } })`
 * (from Route Handlers, Server Actions, or Inngest functions only—never the browser unless you use a public API you control).
 */
export const inngest = new Inngest({
  id: "securewatch360",
  name: "SecureWatch360",
});
