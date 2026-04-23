import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { inngestFunctions } from "@/inngest/functions";

/**
 * Inngest Dev Server and Inngest Cloud call this endpoint to:
 * - GET: discover functions (and show a small dev UI in development)
 * - POST: execute a function step
 * - PUT: register/sync the deployed app and its function graph
 */
export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
