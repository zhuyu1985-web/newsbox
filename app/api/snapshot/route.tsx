import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSnapshotData } from "@/lib/services/snapshot";
import { sha256Hex, stripHtmlToText } from "@/lib/ai-snapshot/hash";
import { renderSnapshotImageResponse } from "@/lib/ai-snapshot/render";
import { isSnapshotTemplate, type SnapshotTemplate } from "@/lib/ai-snapshot/types";

const SIGNED_URL_EXPIRES_IN = 60 * 15;
const DEFAULT_BUCKET = "zhuyu";

async function ensureSnapshotUrl(args: { noteId: string; template: SnapshotTemplate; force?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const { data: note } = await supabase
    .from("notes")
    .select("id,title,content_text,content_html,site_name,published_at,estimated_read_time")
    .eq("id", args.noteId)
    .maybeSingle();

  if (!note) {
    return { error: "Note not found", status: 404 as const };
  }

  const contentText = (note.content_text || "").trim() || stripHtmlToText(note.content_html);
  if (!contentText) {
    return { error: "Note content is empty", status: 400 as const };
  }

  const contentHash = await sha256Hex(`${note.title || ""}\n${contentText}`);

  let snapshot = await supabase
    .from("ai_snapshots")
    .select("id,status,card_data,error_message")
    .eq("note_id", args.noteId)
    .eq("content_hash", contentHash)
    .maybeSingle()
    .then((x) => x.data);

  let inserted = false;
  if (!snapshot) {
    const { data: insertedRow, error } = await supabase
      .from("ai_snapshots")
      .insert({ user_id: user.id, note_id: args.noteId, content_hash: contentHash, status: "generating" })
      .select("id,status,card_data,error_message")
      .single();

    if (!error && insertedRow) {
      snapshot = insertedRow;
      inserted = true;
    } else {
      snapshot = await supabase
        .from("ai_snapshots")
        .select("id,status,card_data,error_message")
        .eq("note_id", args.noteId)
        .eq("content_hash", contentHash)
        .maybeSingle()
        .then((x) => x.data);
    }
  }

  if (!snapshot) {
    return { error: "Failed to ensure snapshot", status: 500 as const };
  }

  if (!snapshot.card_data) {
    if (snapshot.status === "generating" && !inserted && !args.force) {
      return { error: "Snapshot is generating", status: 202 as const };
    }

    if (snapshot.status === "failed" && !args.force) {
      return { error: snapshot.error_message || "Snapshot generation failed", status: 500 as const };
    }

    await supabase.from("ai_snapshots").update({ status: "generating", error_message: null }).eq("id", snapshot.id);

    try {
      const cardData = await generateSnapshotData({
        title: note.title,
        content: contentText,
        sourceName: note.site_name,
        publishTime: note.published_at,
        readTime: note.estimated_read_time,
      });

      const { data: updated } = await supabase
        .from("ai_snapshots")
        .update({ status: "ready", card_data: cardData as any })
        .eq("id", snapshot.id)
        .select("id,status,card_data,error_message")
        .single();

      snapshot = updated || snapshot;
    } catch (e: any) {
      await supabase
        .from("ai_snapshots")
        .update({ status: "failed", error_message: String(e?.message || e || "AI generation failed") })
        .eq("id", snapshot.id);
      return { error: "AI generation failed", status: 500 as const };
    }
  }

  const template = args.template;

  const existingRender = await supabase
    .from("ai_snapshot_renders")
    .select("bucket,object_path")
    .eq("snapshot_id", snapshot.id)
    .eq("template", template)
    .maybeSingle()
    .then((x) => x.data);

  const bucket = existingRender?.bucket || DEFAULT_BUCKET;
  const objectPath = existingRender?.object_path || `${user.id}/notes/${args.noteId}/ai-snapshots/${contentHash}/${template}.png`;

  if (!existingRender?.object_path) {
    const png = renderSnapshotImageResponse(template, snapshot.card_data as any);
    const bytes = await png.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) {
      return { error: "Storage upload failed", status: 500 as const };
    }

    await supabase
      .from("ai_snapshot_renders")
      .upsert(
        {
          snapshot_id: snapshot.id,
          user_id: user.id,
          note_id: args.noteId,
          template,
          bucket,
          object_path: objectPath,
          width: 1200,
          height: 1600,
          content_type: "image/png",
        },
        { onConflict: "snapshot_id,template" },
      );
  }

  const { data } = await supabase.storage.from(bucket).createSignedUrl(objectPath, SIGNED_URL_EXPIRES_IN);
  if (!data?.signedUrl) {
    return { error: "Failed to create signed url", status: 500 as const };
  }

  return { url: data.signedUrl, status: 200 as const };
}

export async function GET(request: NextRequest) {
  const noteId = request.nextUrl.searchParams.get("noteId") || "";
  const templateRaw = request.nextUrl.searchParams.get("template") || "business";
  const template = isSnapshotTemplate(templateRaw) ? templateRaw : "business";

  if (!noteId) {
    return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
  }

  const ensured = await ensureSnapshotUrl({ noteId, template });
  if ("error" in ensured) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.status });
  }

  return NextResponse.redirect(ensured.url, 307);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const noteId = body?.noteId as string | undefined;
  const templateRaw = (body?.template as string | undefined) || "business";
  const template = isSnapshotTemplate(templateRaw) ? templateRaw : "business";
  const force = !!body?.force;

  if (!noteId) {
    return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
  }

  const ensured = await ensureSnapshotUrl({ noteId, template, force });
  if ("error" in ensured) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.status });
  }

  return NextResponse.redirect(ensured.url, 307);
}
