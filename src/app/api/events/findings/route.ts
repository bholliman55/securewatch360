import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!tenantUser?.tenant_id) {
    return new Response("Tenant not found", { status: 403 });
  }

  const tenantId = tenantUser.tenant_id as string;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      const channel = supabase
        .channel(`tenant-live-${tenantId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "findings", filter: `tenant_id=eq.${tenantId}` },
          (payload) => send({ type: "finding", payload: payload.new })
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "external_intelligence_events",
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => send({ type: "intel_event", payload: payload.new })
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "external_assets",
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => send({ type: "asset", payload: payload.new })
        )
        .subscribe();

      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", timestamp: new Date().toISOString() });
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        void supabase.removeChannel(channel);
        try { controller.close(); } catch { /* already closed */ }
      });

      send({ type: "connected", tenantId, timestamp: new Date().toISOString() });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
