import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sha256Hex, stripHtmlToText } from "@/lib/ai-snapshot/hash";
import type { SnapshotTemplate } from "@/lib/ai-snapshot/types";
import { isSnapshotTemplate } from "@/lib/ai-snapshot/types";

const SIGNED_URL_EXPIRES_IN = 60 * 15;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const noteId = request.nextUrl.searchParams.get("noteId") || "";
  const templateRaw = request.nextUrl.searchParams.get("template");
  const template = templateRaw && isSnapshotTemplate(templateRaw) ? (templateRaw as SnapshotTemplate) : undefined;

  if (!noteId) {
    return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
  }

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id,title,content_text,content_html,site_name,published_at,estimated_read_time")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const contentText = (note.content_text || "").trim() || stripHtmlToText(note.content_html);
  const hashBase = `${note.title || ""}\n${contentText}`;
  const contentHash = await sha256Hex(hashBase);

  const { data: snapshot } = await supabase
    .from("ai_snapshots")
    .select("id, status, content_hash, updated_at")
    .eq("note_id", noteId)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (!snapshot) {
    return NextResponse.json({ exists: false, noteId, contentHash });
  }

  let rendersQuery = supabase
    .from("ai_snapshot_renders")
    .select("template,bucket,object_path,created_at")
    .eq("snapshot_id", snapshot.id);

  if (template) {
    rendersQuery = rendersQuery.eq("template", template);
  }

  const { data } = await rendersQuery;
  const renders = data ?? [];

  const rendersWithUrl = await Promise.all(
    renders.map(async (r) => {
      const { data } = await supabase.storage.from(r.bucket).createSignedUrl(r.object_path, SIGNED_URL_EXPIRES_IN);
      return {
        template: r.template,
        url: data?.signedUrl || "",
        createdAt: r.created_at,
      };
    }),
  );

  return NextResponse.json({
    exists: true,
    noteId,
    contentHash,
    snapshotId: snapshot.id,
    status: snapshot.status,
    // 便于前端/调试判断：命中 DB，但 signed url 每次生成都会不同（不代表重新渲染/重新跑 AI）
    renders: rendersWithUrl.filter((x) => x.url),
  });
}
