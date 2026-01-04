import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nameTopicAndReport, type TopicNamingConfig } from "@/lib/services/knowledge-topics";

type Body = {
  mode?: "report_only" | "full";
};

type MemberRow = { note_id: string; score: number | null };

type NoteRow = {
  id: string;
  title: string | null;
  excerpt: string | null;
  content_text: string | null;
};

function getNamingCfg(): TopicNamingConfig {
  const apiKey = (process.env.KNOWLEDGE_TOPIC_NAMING_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const baseUrl = (
    process.env.KNOWLEDGE_TOPIC_NAMING_BASE_URL ||
    process.env.OPENAI_API_BASE_URL ||
    "https://api.openai.com/v1"
  ).trim();
  const model = (process.env.KNOWLEDGE_TOPIC_NAMING_MODEL || process.env.OPENAI_MODEL || "gpt-4o").trim();
  if (!apiKey) throw new Error("KNOWLEDGE_TOPIC_NAMING_API_KEY is not configured");
  return { apiKey, baseUrl, model };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Body;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const topicRes = await supabase
      .from("knowledge_topics")
      .select("id, title, keywords, summary_markdown")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (topicRes.error || !topicRes.data) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    const membersRes = await supabase
      .from("knowledge_topic_members")
      .select("note_id, score")
      .eq("topic_id", id)
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(120);

    if (membersRes.error) {
      return NextResponse.json({ error: "Failed to load members", details: membersRes.error }, { status: 500 });
    }

    const members = (membersRes.data ?? []) as MemberRow[];
    const noteIds = members.map((m) => m.note_id);

    const notesRes = await supabase
      .from("notes")
      .select("id, title, excerpt, content_text")
      .in("id", noteIds)
      .limit(120);

    if (notesRes.error) {
      return NextResponse.json({ error: "Failed to load notes", details: notesRes.error }, { status: 500 });
    }

    const notes = (notesRes.data ?? []) as NoteRow[];
    const noteMap = new Map<string, NoteRow>();
    for (const n of notes) noteMap.set(n.id, n);

    const reps = members
      .map((m) => noteMap.get(m.note_id))
      .filter((n): n is NoteRow => Boolean(n))
      .slice(0, 8);

    const cfg = getNamingCfg();
    const named = await nameTopicAndReport(cfg, { notes: reps });

    const mode = body?.mode === "full" ? "full" : "report_only";
    const payload =
      mode === "full"
        ? { title: named.title, keywords: named.keywords, summary_markdown: named.report_markdown }
        : { summary_markdown: named.report_markdown };

    const upd = await supabase
      .from("knowledge_topics")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, keywords, summary_markdown")
      .single();

    if (upd.error) {
      return NextResponse.json({ error: "Failed to update topic", details: upd.error }, { status: 500 });
    }

    return NextResponse.json({ topic: upd.data });
  } catch (error) {
    console.error("API Error in /api/knowledge/topics/[id]/report:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
