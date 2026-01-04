import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = { sourceTopicId: string };

type MemberRow = {
  note_id: string;
  score: number | null;
  source?: string | null;
  manual_state?: string | null;
  event_time?: string | null;
  event_fingerprint?: string | null;
  evidence_rank?: number | null;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetTopicId } = await context.params;
    const body = (await request.json().catch(() => null)) as Body | null;

    if (!body?.sourceTopicId || typeof body.sourceTopicId !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const sourceTopicId = body.sourceTopicId;
    if (sourceTopicId === targetTopicId) {
      return NextResponse.json({ error: "sourceTopicId must be different" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // verify topics
    const tgt = await supabase.from("knowledge_topics").select("id").eq("id", targetTopicId).eq("user_id", user.id).single();
    const src = await supabase.from("knowledge_topics").select("id").eq("id", sourceTopicId).eq("user_id", user.id).single();

    if (tgt.error || !tgt.data) return NextResponse.json({ error: "Target topic not found" }, { status: 404 });
    if (src.error || !src.data) return NextResponse.json({ error: "Source topic not found" }, { status: 404 });

    const membersRes = await supabase
      .from("knowledge_topic_members")
      .select("note_id, score, source, manual_state, event_time, event_fingerprint, evidence_rank")
      .eq("topic_id", sourceTopicId)
      .eq("user_id", user.id)
      .limit(2000);

    if (membersRes.error) {
      return NextResponse.json({ error: "Failed to load source members", details: membersRes.error }, { status: 500 });
    }

    const members = (membersRes.data ?? []) as MemberRow[];
    if (members.length === 0) {
      // delete empty source topic
      await supabase.from("knowledge_topics").delete().eq("id", sourceTopicId).eq("user_id", user.id);
      return NextResponse.json({ ok: true, merged: 0 });
    }

    const rows = members.map((m) => ({
      topic_id: targetTopicId,
      note_id: m.note_id,
      user_id: user.id,
      score: m.score,
      source: m.source ?? "auto",
      manual_state: m.manual_state ?? null,
      event_time: m.event_time ?? null,
      event_fingerprint: m.event_fingerprint ?? null,
      evidence_rank: m.evidence_rank ?? null,
    }));

    const up = await supabase.from("knowledge_topic_members").upsert(rows, { onConflict: "topic_id,note_id" });
    if (up.error) {
      return NextResponse.json({ error: "Failed to merge members", details: up.error }, { status: 500 });
    }

    const delMembers = await supabase
      .from("knowledge_topic_members")
      .delete()
      .eq("topic_id", sourceTopicId)
      .eq("user_id", user.id);

    if (delMembers.error) {
      return NextResponse.json({ error: "Failed to delete source members", details: delMembers.error }, { status: 500 });
    }

    // delete source events/topic (best-effort)
    await supabase.from("knowledge_topic_events").delete().eq("topic_id", sourceTopicId).eq("user_id", user.id);
    await supabase.from("knowledge_topics").delete().eq("id", sourceTopicId).eq("user_id", user.id);

    // refresh target member_count
    const countRes = await supabase
      .from("knowledge_topic_members")
      .select("topic_id", { count: "exact", head: true })
      .eq("topic_id", targetTopicId)
      .eq("user_id", user.id);

    const member_count = countRes.count ?? null;
    await supabase
      .from("knowledge_topics")
      .update({ member_count: typeof member_count === "number" ? member_count : 0, last_ingested_at: new Date().toISOString() })
      .eq("id", targetTopicId)
      .eq("user_id", user.id);

    // rebuild target events (best-effort)
    try {
      const tgtMembersRes = await supabase
        .from("knowledge_topic_members")
        .select("note_id, event_time, event_fingerprint")
        .eq("topic_id", targetTopicId)
        .eq("user_id", user.id)
        .limit(4000);

      if (!tgtMembersRes.error) {
        const list = (tgtMembersRes.data ?? []) as Array<{ note_id: string; event_time: string | null; event_fingerprint: string | null }>;
        const groups = new Map<string, Array<{ note_id: string; event_time: string }>>();
        for (const m of list) {
          if (!m.event_fingerprint || !m.event_time) continue;
          const g = groups.get(m.event_fingerprint) ?? [];
          g.push({ note_id: m.note_id, event_time: m.event_time });
          groups.set(m.event_fingerprint, g);
        }

        await supabase.from("knowledge_topic_events").delete().eq("topic_id", targetTopicId).eq("user_id", user.id);

        const rows = Array.from(groups.entries()).map(([fp, evs]) => ({
          user_id: user.id,
          topic_id: targetTopicId,
          event_time: evs.map((e) => e.event_time).sort()[0],
          fingerprint: fp,
          importance: Math.log1p(evs.length),
          source: { note_ids: evs.map((e) => e.note_id), count: evs.length },
        }));

        if (rows.length > 0) await supabase.from("knowledge_topic_events").insert(rows);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, merged: members.length });
  } catch (error) {
    console.error("API Error in /api/knowledge/topics/[id]/merge:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
