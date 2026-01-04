import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 检查用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { note_id, quote, range_data, range_start, range_end, color, timecode, screenshot_url } = body;

    // 验证必填字段
    if (!note_id || !quote || !color) {
      return NextResponse.json(
        { error: "缺少必填字段" },
        { status: 400 }
      );
    }

    // 验证笔记是否属于当前用户
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("id")
      .eq("id", note_id)
      .eq("user_id", user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json(
        { error: "笔记不存在或无权访问" },
        { status: 403 }
      );
    }

    // 创建高亮
    const { data: highlight, error: insertError } = await supabase
      .from("highlights")
      .insert({
        user_id: user.id,
        note_id,
        quote,
        range_start: typeof range_start === "number" ? range_start : null,
        range_end: typeof range_end === "number" ? range_end : null,
        range_data,
        color,
        timecode: typeof timecode === "number" ? timecode : null,
        screenshot_url: screenshot_url || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("创建高亮失败:", insertError);
      return NextResponse.json(
        { error: "创建高亮失败", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, highlight });
  } catch (error) {
    console.error("创建高亮出错:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 检查用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 从 URL 获取 note_id
    const { searchParams } = new URL(request.url);
    const note_id = searchParams.get("note_id");

    if (!note_id) {
      return NextResponse.json(
        { error: "缺少 note_id 参数" },
        { status: 400 }
      );
    }

    // 获取该笔记的所有高亮
    const { data: highlights, error: fetchError } = await supabase
      .from("highlights")
      .select("*")
      .eq("note_id", note_id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("获取高亮失败:", fetchError);
      return NextResponse.json(
        { error: "获取高亮失败", details: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, highlights: highlights || [] });
  } catch (error) {
    console.error("获取高亮出错:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    // 检查用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { id, color } = body;

    if (!id || !color) {
      return NextResponse.json(
        { error: "缺少必填字段" },
        { status: 400 }
      );
    }

    // 更新高亮
    const { error: updateError } = await supabase
      .from("highlights")
      .update({ color })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("更新高亮失败:", updateError);
      return NextResponse.json(
        { error: "更新高亮失败", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新高亮出错:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // 检查用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const highlight_id = searchParams.get("id");

    if (!highlight_id) {
      return NextResponse.json(
        { error: "缺少 highlight_id 参数" },
        { status: 400 }
      );
    }

    // 删除高亮（RLS 会确保只能删除自己的）
    const { error: deleteError } = await supabase
      .from("highlights")
      .delete()
      .eq("id", highlight_id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("删除高亮失败:", deleteError);
      return NextResponse.json(
        { error: "删除高亮失败", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除高亮出错:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
