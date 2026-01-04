import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEventFingerprint, extractEventTimeIso } from "@/lib/services/knowledge-topics";

type Body =
  | { action: "add"; noteId: string }
  | { action: "remove"; noteId: string }
  | { action: "confirm"; noteId: string }
  | { action: "exclude"; noteId: string }
  | { action: "set_time"; noteId: string; eventTime: string };

function isoDayKey(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || typeof (body as any).noteId !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const noteId = (body as any).noteId as string;

    if (body.action === "remove" || body.action === "exclude") {
      const del = await supabase
        .from("knowledge_topic_members")
        .delete()
        .eq("topic_id", id)
        .eq("note_id", noteId)
        .eq("user_id", user.id);

      if (del.error) {
        return NextResponse.json({ error: "Failed to remove member", details: del.error }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (body.action === "confirm") {
      const upd = await supabase
        .from("knowledge_topic_members")
        .update({ manual_state: "confirmed", source: "manual" })
        .eq("topic_id", id)
        .eq("note_id", noteId)
        .eq("user_id", user.id)
        .select("topic_id, note_id, source, manual_state")
        .single();

      if (upd.error) {
        return NextResponse.json({ error: "Failed to confirm member", details: upd.error }, { status: 500 });
      }

      return NextResponse.json({ member: upd.data });
    }

    if (body.action === "set_time") {
      const eventTime = typeof (body as any).eventTime === "string" ? (body as any).eventTime : "";
      const d = new Date(eventTime);
      if (!eventTime || !Number.isFinite(d.getTime())) {
        return NextResponse.json({ error: "Invalid eventTime" }, { status: 400 });
      }

      const iso = d.toISOString();

      // 用笔记标题/摘要参与 fingerprint，保证同日可稳定聚合
      const noteRes = await supabase
        .from("notes")
        .select("id, title, excerpt")
        .eq("id", noteId)
        .eq("user_id", user.id)
        .single();

      const title = (noteRes.data?.title || noteRes.data?.excerpt || "").toString();
      const dayKey = isoDayKey(iso);
      const fp = dayKey ? buildEventFingerprint({ topicId: id, dayKey, title }) : null;

      const upd = await supabase
        .from("knowledge_topic_members")
        .update({ event_time: iso, event_fingerprint: fp, source: "manual" })
        .eq("topic_id", id)
        .eq("note_id", noteId)
        .eq("user_id", user.id)
        .select("topic_id, note_id, source, manual_state, event_time, event_fingerprint")
        .single();

      if (upd.error) {
        return NextResponse.json({ error: "Failed to set event time", details: upd.error }, { status: 500 });
      }

      return NextResponse.json({ member: upd.data });
    }

    // add
    const noteRes = await supabase
      .from("notes")
      .select("id, title, excerpt, published_at, created_at")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteRes.error || !noteRes.data) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const eventTime = extractEventTimeIso(noteRes.data);
    const dayKey = eventTime ? isoDayKey(eventTime) : "";
    const fp = dayKey ? buildEventFingerprint({ topicId: id, dayKey, title: (noteRes.data.title || noteRes.data.excerpt || "").toString() }) : null;

    const up = await supabase
      .from("knowledge_topic_members")
      .upsert(
        {
          topic_id: id,
          note_id: noteId,
          user_id: user.id,
          score: null,
          source: "manual",
          manual_state: "manual",
          event_time: eventTime,
          event_fingerprint: fp,
          evidence_rank: null,
        },
        { onConflict: "topic_id,note_id" },
      )
      .select("topic_id, note_id, source, manual_state")
      .single();

    if (up.error) {
      return NextResponse.json({ error: "Failed to add member", details: up.error }, { status: 500 });
    }

    // update member_count best-effort
    await supabase
      .from("knowledge_topics")
      .update({ last_ingested_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ member: up.data });
  } catch (error) {
    console.error("API Error in /api/knowledge/topics/[id]/members:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
