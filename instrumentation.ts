/**
 * Next.js instrumentation — runs on server startup (Node runtime only).
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { runDeploymentStartupGate } = await import("./src/core/deployment/startupGate");
  runDeploymentStartupGate();
}
