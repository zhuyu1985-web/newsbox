import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSnapshotData } from "@/lib/services/snapshot";
import { sha256Hex, stripHtmlToText } from "@/lib/ai-snapshot/hash";
import { renderSnapshotImageResponse } from "@/lib/ai-snapshot/render";
import { isSnapshotTemplate, SNAPSHOT_TEMPLATES, type SnapshotTemplate } from "@/lib/ai-snapshot/types";
import { requireAIMembership } from "@/lib/middleware/membership";

const SIGNED_URL_EXPIRES_IN = 60 * 15;
const DEFAULT_BUCKET = "zhuyu";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: Request) {
  // AI 会员权限检查
  const permCheck = await requireAIMembership();
  if (!permCheck.authorized) {
    return permCheck.response;
  }

  const supabase = await createClient();
  const user = { id: permCheck.userId! };

  const body = await request.json().catch(() => null);
  const noteId = body?.noteId as string | undefined;
  const templateRaw = body?.template as string | undefined;
  const force = !!body?.force;

  const template: SnapshotTemplate | undefined = templateRaw && isSnapshotTemplate(templateRaw) ? templateRaw : undefined;

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
  if (!contentText) {
    return NextResponse.json({ error: "Note content is empty" }, { status: 400 });
  }

  const hashBase = `${note.title || ""}\n${contentText}`;
  const contentHash = await sha256Hex(hashBase);

  // 1) ensure snapshot row (concurrency safe via unique constraint)
  let snapshot = await supabase
    .from("ai_snapshots")
    .select("id,status,card_data,error_message")
    .eq("note_id", noteId)
    .eq("content_hash", contentHash)
    .maybeSingle()
    .then((x) => x.data);

  let inserted = false;
  if (!snapshot) {
    const { data: insertedRow, error: insertError } = await supabase
      .from("ai_snapshots")
      .insert({
        user_id: user.id,
        note_id: noteId,
        content_hash: contentHash,
        status: "generating",
      })
      .select("id,status,card_data,error_message")
      .single();

    if (!insertError && insertedRow) {
      snapshot = insertedRow;
      inserted = true;
    } else {
      // likely unique conflict (another request just inserted). re-select.
      snapshot = await supabase
        .from("ai_snapshots")
        .select("id,status,card_data,error_message")
        .eq("note_id", noteId)
        .eq("content_hash", contentHash)
        .maybeSingle()
        .then((x) => x.data);
    }
  }

  if (!snapshot) {
    return NextResponse.json({ error: "Failed to ensure snapshot" }, { status: 500 });
  }

  // 2) ensure card_data (AI is only called by the request that successfully inserted, or when force retry)
  if (!snapshot.card_data) {
    if (snapshot.status === "generating" && !inserted && !force) {
      // someone else is generating. ask client to retry.
      return NextResponse.json({ status: "generating", noteId, contentHash }, { status: 202 });
    }

    // if failed before, allow force to retry
    if (snapshot.status === "failed" && !force) {
      return NextResponse.json({ error: snapshot.error_message || "Snapshot generation failed" }, { status: 500 });
    }

    // mark generating (idempotent)
    await supabase.from("ai_snapshots").update({ status: "generating", error_message: null }).eq("id", snapshot.id);

    try {
      const cardData = await generateSnapshotData({
        title: note.title,
        content: contentText,
        sourceName: note.site_name,
        publishTime: note.published_at,
        readTime: note.estimated_read_time,
      });

      const provider = "openai";
      const modelName = process.env.OPENAI_MODEL || null;
      const modelVersion = process.env.OPENAI_API_BASE_URL || null;

      const { data: updated } = await supabase
        .from("ai_snapshots")
        .update({
          status: "ready",
          card_data: cardData as any,
          model_provider: provider,
          model_name: modelName,
          model_version: modelVersion,
        })
        .eq("id", snapshot.id)
        .select("id,status,card_data,error_message")
        .single();

      snapshot = updated || snapshot;
    } catch (e: any) {
      await supabase
        .from("ai_snapshots")
        .update({ status: "failed", error_message: String(e?.message || e || "AI generation failed") })
        .eq("id", snapshot.id);

      return NextResponse.json({ error: "AI generation failed", details: String(e?.message || e) }, { status: 500 });
    }
  }

  if (!snapshot.card_data) {
    return NextResponse.json({ error: "Snapshot card_data missing" }, { status: 500 });
  }

  // 3) ensure renders
  const templatesToEnsure: SnapshotTemplate[] = inserted ? [...SNAPSHOT_TEMPLATES] : template ? [template] : ["business"];

  const ensured = [] as Array<{ template: SnapshotTemplate; url: string }>;

  for (const t of templatesToEnsure) {
    const existing = await supabase
      .from("ai_snapshot_renders")
      .select("bucket,object_path,template")
      .eq("snapshot_id", snapshot.id)
      .eq("template", t)
      .maybeSingle()
      .then((x) => x.data);

    let bucket = existing?.bucket || DEFAULT_BUCKET;
    let objectPath = existing?.object_path;

    if (!objectPath) {
      try {
        // render -> upload -> upsert row
        const pngResponse = renderSnapshotImageResponse(t, snapshot.card_data as any);
        const bytes = await pngResponse.arrayBuffer();

        objectPath = `${user.id}/notes/${noteId}/ai-snapshots/${contentHash}/${t}.png`;

        const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
          contentType: "image/png",
          upsert: true,
        });

        if (uploadError) {
          return NextResponse.json(
            { error: "Storage upload failed", template: t, details: uploadError.message },
            { status: 500 },
          );
        }

        await supabase
          .from("ai_snapshot_renders")
          .upsert(
            {
              snapshot_id: snapshot.id,
              user_id: user.id,
              note_id: noteId,
              template: t,
              bucket,
              object_path: objectPath,
              width: 1200,
              height: 1600,
              content_type: "image/png",
            },
            { onConflict: "snapshot_id,template" },
          );
      } catch (e: any) {
        console.error("Snapshot render/upload failed:", { noteId, template: t }, e);
        return NextResponse.json(
          { error: "Snapshot render failed", template: t, details: String(e?.message || e) },
          { status: 500 },
        );
      }
    }

    const { data } = await supabase.storage.from(bucket).createSignedUrl(objectPath, SIGNED_URL_EXPIRES_IN);

    if (data?.signedUrl) {
      ensured.push({ template: t, url: data.signedUrl });
    }

    // tiny delay to reduce burst when first rendering all templates (optional)
    await sleep(10);
  }

  const preferredTemplate = template || (inserted ? "business" : templatesToEnsure[0]);
  const preferredUrl = ensured.find((x) => x.template === preferredTemplate)?.url || ensured[0]?.url || "";

  return NextResponse.json({
    status: "ready",
    noteId,
    contentHash,
    snapshotId: snapshot.id,
    template: preferredTemplate,
    url: preferredUrl,
    renders: ensured,
  });
}
