import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isTranscriptMarkersTableMissing,
  TRANSCRIPT_MARKERS_UNAVAILABLE_MESSAGE,
} from "@/lib/notes/marker-errors";

/**
 * DELETE /api/notes/[id]/markers/[markerId] — 删除一个 marker
 * 用于「取消标记」/ 撤销单条
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; markerId: string }> },
) {
  const { id, markerId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS 已经按 user_id 限制，但显式带上 note_id 校验避免跨笔记误删
  const { error } = await supabase
    .from("transcript_markers")
    .delete()
    .eq("id", markerId)
    .eq("note_id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[markers] delete failed", error);
    if (isTranscriptMarkersTableMissing(error)) {
      return NextResponse.json(
        {
          error: TRANSCRIPT_MARKERS_UNAVAILABLE_MESSAGE,
          available: false,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
