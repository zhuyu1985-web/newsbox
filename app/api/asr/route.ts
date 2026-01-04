import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/services/tencent-asr";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { noteId, audioUrl } = body;

    if (!noteId || !audioUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. 检查是否已经存在转写
    const { data: existing } = await supabase
      .from("transcripts")
      .select("id, status")
      .eq("note_id", noteId)
      .single();

    if (existing && existing.status === 'completed') {
      return NextResponse.json({ success: true, message: "Already exists" });
    }

    // 2. 更新或插入初始状态
    if (existing) {
      await supabase
        .from("transcripts")
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq("note_id", noteId);
    } else {
      await supabase
        .from("transcripts")
        .insert({
          note_id: noteId,
          user_id: user.id,
          full_text: "",
          segments: [],
          status: 'processing',
          provider: 'tencent'
        });
    }

    // 3. 开始转写 (这里使用长轮询，如果音频很长可能会超时，建议生产环境用异步队列)
    // 但为了演示和快速实现，我们先这样处理
    try {
      const result = await transcribeAudio(audioUrl);

      // 4. 更新结果
      const { error: updateError } = await supabase
        .from("transcripts")
        .update({
          full_text: result.fullText,
          segments: result.segments,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq("note_id", noteId);

      if (updateError) throw updateError;

      return NextResponse.json({ 
        success: true, 
        fullText: result.fullText,
        segments: result.segments
      });
    } catch (asrError: any) {
      console.error("ASR Transcription failed:", asrError);
      
      await supabase
        .from("transcripts")
        .update({ 
          status: 'failed', 
          error_message: asrError.message || "Unknown ASR error" 
        })
        .eq("note_id", noteId);
        
      return NextResponse.json({ error: "Transcription failed", details: asrError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("ASR API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get("noteId");

  if (!noteId) {
    return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("note_id", noteId)
    .single();

  if (error) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
