import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { inngestFunctions } from "@/inngest/functions";

/**
 * Inngest uses this App Route to sync and invoke functions.
 * Point your Inngest app URL here (e.g. https://<host>/api/inngest).
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
