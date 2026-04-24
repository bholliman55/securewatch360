import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { requireTenantAccessForFinding } from "@/lib/tenant-guard";
import { writeAuditLog } from "@/lib/audit";

type NotesBody = {
  note?: unknown;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid finding id" }, { status: 400 });
    }

    const body = (await request.json()) as NotesBody;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!note) {
      return NextResponse.json({ ok: false, error: "note is required" }, { status: 400 });
    }
    if (note.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "note must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const guard = await requireTenantAccessForFinding({
      findingId: id,
      allowedRoles: ["owner", "admin", "analyst"],
    });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: loadError } = await supabase
      .from("findings")
      .select("id, notes")
      .eq("id", id)
      .single();

    if (loadError || !existing) {
      return NextResponse.json(
        { ok: false, error: loadError?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    const stampedNote = `[${new Date().toISOString()}] ${note}`;
    const updatedNotes = existing.notes ? `${existing.notes}\n${stampedNote}` : stampedNote;

    const { data, error } = await supabase
      .from("findings")
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, assigned_to_user_id, notes, updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Finding not found" },
        { status: 404 }
      );
    }

    await writeAuditLog({
      userId: guard.userId,
      tenantId: guard.tenantId,
      entityType: "finding",
      entityId: id,
      action: "finding.note.added",
      summary: "Finding note appended",
      payload: {
        findingId: id,
        noteLength: note.length,
      },
    });

    return NextResponse.json({ ok: true, finding: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to add finding note", message },
      { status: 500 }
    );
  }
}
