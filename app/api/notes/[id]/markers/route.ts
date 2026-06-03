import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notes/[id]/markers — 列出该笔记的所有 marker
 * POST /api/notes/[id]/markers — 新建一个 marker
 */

const ALLOWED_KINDS = new Set(["important", "question", "todo"]);
const ALLOWED_TARGETS = new Set(["transcript", "qa", "speaker"]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 先校验 note 归属（防止跨用户 leak）
  const { data: note } = await supabase
    .from("notes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("transcript_markers")
    .select("*")
    .eq("note_id", id)
    .order("anchor_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ markers: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    marker_kind?: unknown;
    target_type?: unknown;
    segment_idx?: unknown;
    speaker_id?: unknown;
    anchor_time?: unknown;
    selection_start?: unknown;
    selection_end?: unknown;
    selection_text?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const kind = String(body.marker_kind ?? "");
  const target = String(body.target_type ?? "");
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid marker_kind" }, { status: 400 });
  }
  if (!ALLOWED_TARGETS.has(target)) {
    return NextResponse.json({ error: "invalid target_type" }, { status: 400 });
  }
  if (target === "speaker" && !body.speaker_id) {
    return NextResponse.json({ error: "speaker_id required for target_type=speaker" }, { status: 400 });
  }

  // 校验 note 归属
  const { data: note } = await supabase
    .from("notes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const seg = body.segment_idx == null ? null : Number(body.segment_idx);
  const start = body.selection_start == null ? null : Number(body.selection_start);
  const end = body.selection_end == null ? null : Number(body.selection_end);
  const anchor = body.anchor_time == null ? null : Number(body.anchor_time);

  // 选段标记：start/end 必须同时存在且 end>start
  if ((start != null) !== (end != null)) {
    return NextResponse.json(
      { error: "selection_start and selection_end must be provided together" },
      { status: 400 },
    );
  }
  if (start != null && end != null && end <= start) {
    return NextResponse.json({ error: "selection_end must be > selection_start" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transcript_markers")
    .insert({
      user_id: user.id,
      note_id: id,
      marker_kind: kind as "important" | "question" | "todo",
      target_type: target as "transcript" | "qa" | "speaker",
      segment_idx: Number.isFinite(seg) ? seg : null,
      speaker_id: body.speaker_id ? String(body.speaker_id) : null,
      anchor_time: Number.isFinite(anchor) ? anchor : null,
      selection_start: Number.isFinite(start) ? start : null,
      selection_end: Number.isFinite(end) ? end : null,
      selection_text: body.selection_text ? String(body.selection_text) : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[markers] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ marker: data });
}
