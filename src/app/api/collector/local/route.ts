import { readFile } from "fs/promises";
import path from "path";

const COLLECTOR_JSON_PATH = path.join(
  process.cwd(),
  "collectors",
  "site-collector",
  "output",
  "latest-inventory.json"
);

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(
      JSON.stringify({
        error: "Local collector dashboard is only available in development.",
      }),
      {
        status: 404,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const contents = await readFile(COLLECTOR_JSON_PATH, "utf8");
    return new Response(contents, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Local collector inventory file not found.",
        detail:
          error instanceof Error ? error.message : String(error ?? "unknown"),
      }),
      {
        status: 404,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
