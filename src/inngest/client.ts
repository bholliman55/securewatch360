import { Inngest } from "inngest";

/**
 * One Inngest app per deployable. Event names: prefer a `sw360/` prefix.
 * Send events with `inngest.send({ name: "sw360/...", data: { ... } })`.
 */
export const inngest = new Inngest({ id: "securewatch360", name: "SecureWatch360" });
