import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { 
  extractGraphFromText, 
  processAndStoreGraph, 
  ExtractionResult 
} from "@/lib/services/knowledge-graph";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. 获取最近的笔记
    const { data: notes, error: notesError } = await supabase
      .from("notes")
      .select("id, title, excerpt, content_text")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10); // 先处理最近 10 篇作为示例

    if (notesError) throw notesError;

    const apiKey = process.env.KNOWLEDGE_TOPIC_NAMING_API_KEY || process.env.OPENAI_API_KEY || "";
    const baseUrl = process.env.KNOWLEDGE_TOPIC_NAMING_BASE_URL || process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.KNOWLEDGE_TOPIC_NAMING_MODEL || "gpt-4o-mini";

    const cfg = { apiKey, baseUrl, model };

    const results = [];

    for (const note of notes) {
      const text = `${note.title}\n${note.excerpt}\n${note.content_text}`;
      try {
        const extraction = await extractGraphFromText(cfg, text);
        const stored = await processAndStoreGraph(supabase, user.id, note.id, extraction);
        results.push({ noteId: note.id, ...stored });
      } catch (e) {
        console.error(`Failed to extract graph for note ${note.id}:`, e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processedNotes: results.length,
      details: results
    });
  } catch (error) {
    console.error("Graph rebuild error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
