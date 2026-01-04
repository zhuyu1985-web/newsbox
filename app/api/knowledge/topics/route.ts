import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const base = supabase
      .from("knowledge_topics")
      .select(
        "id, title, keywords, summary_markdown, member_count, config, pinned, pinned_at, archived, archived_at, last_ingested_at, updated_at, created_at",
      )
      .eq("user_id", user.id)
      .limit(80);

    // 兼容旧库：如果 pinned/archived 字段还未迁移，不阻断列表展示
    let res: { data: unknown[] | null; error: any } = await base
      .order("pinned", { ascending: false })
      .order("pinned_at", { ascending: false })
      .order("archived", { ascending: true })
      .order("updated_at", { ascending: false });

    if (res.error && typeof res.error.message === "string" && res.error.message.includes("pinned")) {
      res = await supabase
        .from("knowledge_topics")
        .select("id, title, keywords, summary_markdown, member_count, config, updated_at, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(80);
    }

    if (res.error) {
      return NextResponse.json({ error: "Failed to load topics", details: res.error }, { status: 500 });
    }

    return NextResponse.json({ topics: res.data ?? [] });
  } catch (error) {
    console.error("API Error in /api/knowledge/topics:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
