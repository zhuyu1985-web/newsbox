import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { archived?: boolean };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const nextArchived = typeof body?.archived === "boolean" ? body.archived : true;
    const payload = nextArchived
      ? { archived: true, archived_at: new Date().toISOString() }
      : { archived: false, archived_at: null };

    const res = await supabase
      .from("knowledge_topics")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, archived, archived_at")
      .single();

    if (res.error) {
      return NextResponse.json({ error: "Failed to update topic", details: res.error }, { status: 500 });
    }

    return NextResponse.json({ topic: res.data });
  } catch (error) {
    console.error("API Error in /api/knowledge/topics/[id]/archive:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
