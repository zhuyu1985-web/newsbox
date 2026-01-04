import { NextRequest, NextResponse } from "next/server";
import { generateAIAnalysis } from "@/lib/services/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { noteId, type = "all" } = await request.json();

    if (!noteId) {
      return NextResponse.json({ error: "noteId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. 获取笔记内容
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("content_text, content_html, title")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const content = note.content_text || note.content_html || note.title || "";
    if (!content) {
      return NextResponse.json({ error: "No content to analyze" }, { status: 400 });
    }

    // 2. 调用 AI 分析
    let analysis;
    try {
      analysis = await generateAIAnalysis(content, type);
    } catch (error) {
      console.error("AI analysis failed:", error);
      return NextResponse.json(
        { error: "AI analysis failed", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }

    // 3. 保存到 ai_outputs 表
    // 注意：Migration 008 扩展了 ai_outputs 表
    const { data: output, error: saveError } = await supabase
      .from("ai_outputs")
      .upsert({
        note_id: noteId,
        user_id: user.id,
        summary: analysis.summary || null,
        journalist_view: analysis.journalist_view || null,
        timeline: analysis.timeline || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'note_id' })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save AI output:", saveError);
    }

    return NextResponse.json({
      success: true,
      data: output || analysis,
    });
  } catch (error) {
    console.error("API Error in /api/ai/analyze:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
