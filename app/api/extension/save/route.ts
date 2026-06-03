import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify-extension-auth";

export async function POST(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, supabase } = auth;

  try {
    const body = await request.json();
    const {
      source_url,
      title,
      excerpt,
      content_html,
      content_text,
      cover_image_url,
      author,
      site_name,
      published_at,
      content_type = "article",
      folder_id,
      tag_ids,
    } = body;

    if (!source_url) {
      return NextResponse.json(
        { error: "source_url is required" },
        { status: 400 }
      );
    }

    // Check if note already exists for this user + URL
    const { data: existing } = await supabase
      .from("notes")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_url", source_url)
      .maybeSingle();

    let noteId: string;
    let isNew: boolean;

    const noteData: Record<string, unknown> = {
      source_url,
      title: title || null,
      excerpt: excerpt || null,
      content_html: content_html || null,
      content_text: content_text ? content_text.substring(0, 5000) : null,
      cover_image_url: cover_image_url || null,
      author: author || null,
      site_name: site_name || null,
      published_at: published_at || null,
      content_type,
      captured_at: new Date().toISOString(),
      source_type: "url",
    };

    if (folder_id) {
      noteData.folder_id = folder_id;
    }

    if (existing) {
      // Update existing note；
      // 命中既有行可能是软删除残留（用户删除后又重新抓取同一 URL），重置 deleted_at
      // 否则页面看似保存成功，dashboard 和详情页都会按 deleted_at 把它过滤掉。
      const { error } = await supabase
        .from("notes")
        .update({ ...noteData, deleted_at: null })
        .eq("id", existing.id);

      if (error) throw error;
      noteId = existing.id;
      isNew = false;
    } else {
      // Insert new note
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          status: "unread",
          ...noteData,
        })
        .select("id")
        .single();

      if (error) throw error;
      noteId = data.id;
      isNew = true;
    }

    // Handle tags
    if (tag_ids && tag_ids.length > 0) {
      // Remove existing tags if updating
      if (!isNew) {
        await supabase
          .from("note_tags")
          .delete()
          .eq("note_id", noteId);
      }

      // Insert new tag associations
      const tagRows = tag_ids.map((tagId: string) => ({
        note_id: noteId,
        tag_id: tagId,
      }));
      await supabase.from("note_tags").insert(tagRows);
    }

    // If content is missing or too short, trigger server-side capture
    const needsCapture = !content_html || content_html.length < 100;
    if (needsCapture) {
      // Fire-and-forget: trigger capture asynchronously
      const captureUrl = new URL("/api/capture", request.url);
      fetch(captureUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward auth header so capture API can verify
          ...(request.headers.get("Authorization")
            ? { Authorization: request.headers.get("Authorization")! }
            : {}),
        },
        body: JSON.stringify({ noteId, url: source_url }),
      }).catch(() => {
        // Ignore capture errors - the note is already saved
      });
    }

    return NextResponse.json({
      success: true,
      noteId,
      isNew,
      needsCapture,
    });
  } catch (error) {
    console.error("[extension/save] Error:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}
