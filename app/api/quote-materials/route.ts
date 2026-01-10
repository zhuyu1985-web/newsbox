import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeForIlike(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("note_id");
    const q = (searchParams.get("q") || "").trim();
    const annotationIds = parseIds(searchParams.get("annotation_ids"));
    const highlightIds = parseIds(searchParams.get("highlight_ids"));

    const limitRaw = Number(searchParams.get("limit") || "50");
    const pageRaw = Number(searchParams.get("page") || "1");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let queryBuilder = supabase
      .from("quote_materials")
      .select("id, note_id, highlight_id, annotation_id, content, source_type, created_at, notes(title, source_url, site_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (noteId) queryBuilder = queryBuilder.eq("note_id", noteId);
    if (annotationIds.length > 0) queryBuilder = queryBuilder.in("annotation_id", annotationIds);
    if (highlightIds.length > 0) queryBuilder = queryBuilder.in("highlight_id", highlightIds);
    if (q) queryBuilder = queryBuilder.ilike("content", `%${escapeForIlike(q)}%`);

    const { data, error } = await queryBuilder.range(from, to);

    if (error) {
      console.error("List quote_materials failed:", error);
      return NextResponse.json({ error: "获取金句素材失败", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, items: data || [], page, limit });
  } catch (error) {
    console.error("List quote_materials error:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const annotationId = typeof body?.annotation_id === "string" ? body.annotation_id.trim() : "";
    let highlightId = typeof body?.highlight_id === "string" ? body.highlight_id.trim() : "";

    let noteId = typeof body?.note_id === "string" ? body.note_id.trim() : "";
    let content = typeof body?.content === "string" ? body.content.trim() : "";
    const sourceType = typeof body?.source_type === "string" && body.source_type.trim() ? body.source_type.trim() : "manual";
    const sourceMeta = typeof body?.source_meta === "object" ? body.source_meta : null;

    if (annotationId) {
      const existing = await supabase
        .from("quote_materials")
        .select("id, note_id, highlight_id, annotation_id, content, source_type, created_at, notes(title, source_url, site_name)")
        .eq("user_id", user.id)
        .eq("annotation_id", annotationId)
        .maybeSingle();

      if (!existing.error && existing.data) {
        return NextResponse.json({ success: true, item: existing.data, existed: true });
      }

      const { data: ann, error: annError } = await supabase
        .from("annotations")
        .select("id, note_id, content, highlight_id, highlights(quote)")
        .eq("id", annotationId)
        .eq("user_id", user.id)
        .single();

      if (annError || !ann) {
        return NextResponse.json({ error: "批注不存在或无权访问" }, { status: 403 });
      }

      noteId = ann.note_id;
      highlightId = String((ann as any)?.highlight_id || highlightId || "").trim();
      const quoteFromHighlight = (ann as any)?.highlights?.quote;
      content = String(quoteFromHighlight || ann.content || "").trim();
      if (!content) {
        return NextResponse.json({ error: "批注内容为空，无法设为金句素材" }, { status: 400 });
      }
    } else if (highlightId) {
      const existing = await supabase
        .from("quote_materials")
        .select("id, note_id, highlight_id, annotation_id, content, source_type, created_at, notes(title, source_url, site_name)")
        .eq("user_id", user.id)
        .eq("highlight_id", highlightId)
        .maybeSingle();

      if (!existing.error && existing.data) {
        return NextResponse.json({ success: true, item: existing.data, existed: true });
      }

      const { data: h, error: hError } = await supabase
        .from("highlights")
        .select("id, note_id, quote")
        .eq("id", highlightId)
        .eq("user_id", user.id)
        .single();

      if (hError || !h) {
        return NextResponse.json({ error: "高亮不存在或无权访问" }, { status: 403 });
      }

      noteId = h.note_id;
      content = String(h.quote || "").trim();
      if (!content) {
        return NextResponse.json({ error: "高亮内容为空，无法设为金句素材" }, { status: 400 });
      }
    } else if (!noteId || !content) {
      return NextResponse.json({ error: "缺少必填字段（annotation_id 或 highlight_id 或 note_id+content）" }, { status: 400 });
    }

    // Verify note belongs to user (defense in depth).
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("id")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: "笔记不存在或无权访问" }, { status: 403 });
    }

    const insert = await supabase
      .from("quote_materials")
      .upsert(
        {
          user_id: user.id,
          note_id: noteId,
          highlight_id: highlightId || null,
          annotation_id: annotationId || null,
          content,
          source_type: sourceType,
          source_meta: sourceMeta,
        },
        { onConflict: "user_id,note_id,content_hash", ignoreDuplicates: true },
      )
      .select("id, note_id, highlight_id, annotation_id, content, source_type, created_at, notes(title, source_url, site_name)")
      .maybeSingle();

    if (insert.error) {
      console.error("Create quote_material failed:", insert.error);
      return NextResponse.json({ error: "创建金句素材失败", details: insert.error.message }, { status: 500 });
    }

    if (insert.data) {
      return NextResponse.json({ success: true, item: insert.data, existed: false });
    }

    // Duplicate ignored by upsert: fetch existing record by exact content.
    const existingByContent = await supabase
      .from("quote_materials")
      .select("id, note_id, highlight_id, annotation_id, content, source_type, created_at, notes(title, source_url, site_name)")
      .eq("user_id", user.id)
      .eq("note_id", noteId)
      .eq("content", content)
      .maybeSingle();

    if (existingByContent.error) {
      console.error("Fetch existing quote_material failed:", existingByContent.error);
      return NextResponse.json({ error: "创建金句素材失败", details: existingByContent.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: existingByContent.data, existed: true });
  } catch (error) {
    console.error("Create quote_material error:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = (searchParams.get("id") || "").trim();

    if (!id) {
      return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
    }

    const { error } = await supabase.from("quote_materials").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      console.error("Delete quote_material failed:", error);
      return NextResponse.json({ error: "删除金句素材失败", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete quote_material error:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}
