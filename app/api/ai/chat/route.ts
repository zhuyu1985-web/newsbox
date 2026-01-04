import { NextRequest, NextResponse } from "next/server";
import { chatWithAI } from "@/lib/services/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { noteId, messages } = await request.json();

    if (!noteId || !messages) {
      return NextResponse.json({ error: "noteId and messages are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. 获取笔记内容作为上下文
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

    // 2. 调用 AI 追问 (流式)
    const response = await chatWithAI(content, messages);

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: "AI chat failed", details: error }, { status: response.status });
    }

    // 返回流式响应
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("API Error in /api/ai/chat:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
