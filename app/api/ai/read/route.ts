import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDeepAnalysis, generateFlashRead, generateKeyQuestions } from "@/lib/services/openai";
import { requireAuth } from "@/lib/middleware/membership";

function estimateReadTimeMinutes(text: string): number {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;

  // 粗略：中文按 400 字/分钟，英文按 200 词/分钟，取更保守的更大值
  const zhChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
  const enWords = (trimmed.match(/[A-Za-z]+/g) || []).length;

  const byZh = zhChars > 0 ? zhChars / 400 : 0;
  const byEn = enWords > 0 ? enWords / 200 : 0;

  const minutes = Math.ceil(Math.max(byZh, byEn, trimmed.length / 1200));
  return Math.max(1, minutes);
}

function hasCompleteAnalysis(cached: any): boolean {
  const hasSummary = Boolean(String(cached?.summary || "").trim());
  const hasKeyQuestions = Array.isArray(cached?.key_questions) && cached.key_questions.length > 0;
  const hasDeepOverview = Boolean(String(cached?.journalist_view?.deep_read?.overview || "").trim());
  const hasTimeline = Array.isArray(cached?.timeline) && cached.timeline.length > 0;

  return hasSummary && hasKeyQuestions && hasDeepOverview && hasTimeline;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (event: string, data: any) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(payload));
  };

  const close = async () => {
    try {
      await writer.close();
    } catch {
      // ignore
    }
  };

  const run = (async () => {
    try {
      const authCheck = await requireAuth();
      if (!authCheck.authorized) {
        await send("error", { message: "请先登录", code: "UNAUTHORIZED" });
        return;
      }

      const { noteId, force = false } = await request.json();

      if (!noteId) {
        await send("error", { message: "noteId is required" });
        return;
      }

      const supabase = await createClient();
      const user = { id: authCheck.userId! };

      const { data: note, error: noteError } = await supabase
        .from("notes")
        .select("id, user_id, title, content_text, content_html, estimated_read_time")
        .eq("id", noteId)
        .eq("user_id", user.id)
        .single();

      if (noteError || !note) {
        await send("error", { message: "Note not found" });
        return;
      }

      const content = (note.content_text || note.content_html || "").toString();
      if (!content.trim() && !(note.title || "").trim()) {
        await send("error", { message: "No content to analyze" });
        return;
      }

      const estimatedReadTimeMinutes =
        typeof note.estimated_read_time === "number" && note.estimated_read_time > 0
          ? note.estimated_read_time
          : estimateReadTimeMinutes(content);

      await send("meta", {
        noteId,
        estimatedReadTimeMinutes,
      });

      const { data: cached } = await supabase
        .from("ai_outputs")
        .select("summary, key_questions, journalist_view, timeline")
        .eq("note_id", noteId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cached) {
        await send("cached", {
          summary: cached.summary,
          key_questions: cached.key_questions,
          journalist_view: cached.journalist_view,
          timeline: cached.timeline,
        });
      }

      if (!force && cached && hasCompleteAnalysis(cached)) {
        await send("done", { ok: true, cached: true });
        return;
      }

      await send("progress", { step: "flash_read" });
      const fastRead = await generateFlashRead({
        title: note.title,
        content,
        estimatedReadTimeMinutes,
      });
      await send("fast_read", fastRead);

      await send("progress", { step: "key_questions" });
      const keyQuestions = await generateKeyQuestions({ title: note.title, content });
      await send("key_questions", keyQuestions);

      await send("progress", { step: "deep_analysis" });
      const deepAnalysis = await generateDeepAnalysis({ title: note.title, content });
      await send("deep_analysis", deepAnalysis);

      const mergedJournalistView = {
        ...((cached as any)?.journalist_view || {}),
        fast_read: {
          hook: fastRead.hook,
          takeaways: fastRead.takeaways,
          sentiment: fastRead.sentiment,
          read_time_minutes: fastRead.read_time_minutes ?? estimatedReadTimeMinutes,
        },
        key_questions_missing: keyQuestions.missing || [],
        deep_read: {
          overview: deepAnalysis.overview,
          background: deepAnalysis.background,
          stakeholders: deepAnalysis.stakeholders,
          implications: deepAnalysis.implications,
          risks: deepAnalysis.risks,
          watchpoints: deepAnalysis.watchpoints,
        },
      };

      const mergedTimeline =
        deepAnalysis.timeline.length > 0
          ? deepAnalysis.timeline
          : Array.isArray((cached as any)?.timeline)
            ? (cached as any).timeline
            : [];

      const { error: saveError } = await supabase
        .from("ai_outputs")
        .upsert(
          {
            note_id: noteId,
            user_id: user.id,
            summary: fastRead.hook || deepAnalysis.overview || (note.title || "") || "",
            key_questions: keyQuestions.questions || [],
            journalist_view: mergedJournalistView,
            timeline: mergedTimeline,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "note_id" }
        );

      if (saveError) {
        await send("warn", { message: "Failed to save ai output", detail: saveError.message });
      }

      await send("done", { ok: true, cached: false });
    } catch (e) {
      await send("error", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      await close();
    }
  })();

  request.signal?.addEventListener("abort", () => {
    close();
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
