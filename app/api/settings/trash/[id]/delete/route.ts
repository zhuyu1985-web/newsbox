import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // Only allow permanent delete if it's currently in recycle bin
  const { data: note } = await supabase
    .from("notes")
    .select("id, deleted_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!note?.deleted_at) {
    return NextResponse.json({ error: "仅允许永久删除回收站中的笔记" }, { status: 400 });
  }

  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


