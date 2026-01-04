import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TopicRow = {
  id: string;
  title: string | null;
  keywords: string[] | null;
  summary_markdown: string | null;
  member_count: number | null;
  config: unknown;
  pinned?: boolean | null;
  pinned_at?: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
  last_ingested_at?: string | null;
  updated_at: string;
  created_at: string;
};

type MemberRow = {
  note_id: string;
  score: number | null;
  source?: string | null;
  manual_state?: string | null;
  event_time?: string | null;
  event_fingerprint?: string | null;
  evidence_rank?: number | null;
};

type NoteRow = {
  id: string;
  title: string | null;
  excerpt: string | null;
  site_name: string | null;
  source_url: string | null;
  published_at: string | null;
  created_at: string;
  content_type: "article" | "video" | "audio";
  cover_image_url: string | null;
};

type TopicEventRow = {
  id: string;
  event_time: string;
  title: string | null;
  summary: string | null;
  fingerprint: string;
  importance: number | null;
  source: any;
};

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const topicRes = await supabase
      .from("knowledge_topics")
      .select(
        "id, title, keywords, summary_markdown, member_count, config, pinned, pinned_at, archived, archived_at, last_ingested_at, updated_at, created_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (topicRes.error || !topicRes.data) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const topic = topicRes.data as TopicRow;

    // members
    let membersRes: { data: unknown[] | null; error: any } = await supabase
      .from("knowledge_topic_members")
      .select("note_id, score, source, manual_state, event_time, event_fingerprint, evidence_rank")
      .eq("topic_id", id)
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(800);

    if (membersRes.error && typeof membersRes.error.message === "string" && membersRes.error.message.includes("source")) {
      // 兼容旧库（无扩展字段）
      membersRes = await supabase
        .from("knowledge_topic_members")
        .select("note_id, score")
        .eq("topic_id", id)
        .eq("user_id", user.id)
        .order("score", { ascending: false })
        .limit(800);
    }

    if (membersRes.error) {
      return NextResponse.json({ error: "Failed to load topic members", details: membersRes.error }, { status: 500 });
    }

    const members = (membersRes.data ?? []) as MemberRow[];
    const noteIds = members.map((m) => m.note_id);

    let notes: NoteRow[] = [];
    if (noteIds.length > 0) {
      const notesRes = await supabase
        .from("notes")
        .select("id, title, excerpt, site_name, source_url, published_at, created_at, content_type, cover_image_url")
        .in("id", noteIds);

      if (notesRes.error) {
        return NextResponse.json({ error: "Failed to load notes", details: notesRes.error }, { status: 500 });
      }

      notes = (notesRes.data ?? []) as NoteRow[];
    }

    const noteMap = new Map<string, NoteRow>();
    for (const n of notes) noteMap.set(n.id, n);

    const items = members
      .map((m) => {
        const note = noteMap.get(m.note_id);
        if (!note) return null;
        const time = (m.event_time || note.published_at || note.created_at) as string;
        return {
          noteId: m.note_id,
          score: m.score,
          time,
          source: m.source ?? null,
          manual_state: m.manual_state ?? null,
          event_time: m.event_time ?? null,
          event_fingerprint: m.event_fingerprint ?? null,
          evidence_rank: m.evidence_rank ?? null,
          note,
        };
      })
      .filter(
        (x): x is {
          noteId: string;
          score: number | null;
          time: string;
          source: string | null;
          manual_state: string | null;
          event_time: string | null;
          event_fingerprint: string | null;
          evidence_rank: number | null;
          note: NoteRow;
        } => Boolean(x),
      );

    const timeline = items.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // events (best-effort)
    let events: Array<{
      id: string;
      event_time: string;
      title: string | null;
      summary: string | null;
      fingerprint: string;
      importance: number | null;
      evidence: typeof items;
    }> = [];

    try {
      const eventsRes = await supabase
        .from("knowledge_topic_events")
        .select("id, event_time, title, summary, fingerprint, importance, source")
        .eq("topic_id", id)
        .eq("user_id", user.id)
        .order("event_time", { ascending: true })
        .limit(400);

      if (!eventsRes.error) {
        const rows = (eventsRes.data ?? []) as TopicEventRow[];

        const byFp = new Map<string, typeof items>();
        for (const it of items) {
          if (!it.event_fingerprint) continue;
          const list = byFp.get(it.event_fingerprint) ?? [];
          list.push(it);
          byFp.set(it.event_fingerprint, list);
        }

        events = rows.map((r) => {
          const sourceIds = Array.isArray(r?.source?.note_ids) ? (r.source.note_ids as string[]) : null;
          let evidence = byFp.get(r.fingerprint) ?? [];
          if (sourceIds && sourceIds.length > 0) {
            const set = new Set(sourceIds);
            evidence = items.filter((it) => set.has(it.noteId));
          }
          evidence = evidence
            .slice()
            .sort((a, b) => (a.evidence_rank ?? 9999) - (b.evidence_rank ?? 9999) || (b.score ?? 0) - (a.score ?? 0));

          return {
            id: r.id,
            event_time: r.event_time,
            title: r.title,
            summary: r.summary,
            fingerprint: r.fingerprint,
            importance: r.importance ?? null,
            evidence,
          };
        });
      }
    } catch {
      // ignore if table not exists
    }

    return NextResponse.json({ topic, members: items, timeline, events });
  } catch (error) {
    console.error("API Error in /api/knowledge/topics/[id]:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
