import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server-service";
import type { AudioAnalysisResult, TranscriptSegment } from "@/lib/ai-analysis/types";

/**
 * POST /api/ai/video/[jobId]/enrich
 * - 用 LLM 兜底补齐听悟没返回的字段：keywords 和 qaPairs
 * - 只补缺失的：?fields=keywords,qa（默认两个都补）
 * - 结果合并写回 video_jobs.audio_result
 *
 * 设计：
 * - 单次请求最多读 transcript 前 200 段，避免 token 爆炸
 * - 用 JSON mode，结构化输出
 * - anchorTime 让 LLM 自己定位最相关的句子时间戳
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: job, error: jobError } = await service
    .from("video_jobs")
    .select("id, user_id, audio_result, audio_status")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();
  if (jobError || !job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (job.audio_status !== "done") {
    return NextResponse.json(
      { error: "audio analysis not done yet" },
      { status: 409 },
    );
  }

  const audio = (job.audio_result ?? {}) as unknown as AudioAnalysisResult;
  const transcript: TranscriptSegment[] = audio.transcript ?? [];
  const summary = audio.summary ?? "";

  if (transcript.length === 0) {
    return NextResponse.json({ error: "no transcript to enrich" }, { status: 400 });
  }

  const url = new URL(req.url);
  const fieldsParam = url.searchParams.get("fields");
  const requested = new Set(
    (fieldsParam ? fieldsParam.split(",") : ["keywords", "qa"]).map((s) => s.trim()),
  );
  const wantKeywords = requested.has("keywords");
  const wantQa = requested.has("qa");
  if (!wantKeywords && !wantQa) {
    return NextResponse.json({ error: "no fields requested" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service unavailable (OPENAI_API_KEY missing)" },
      { status: 503 },
    );
  }

  // 控制 token：前 200 段，每段保留时间戳 + 文本
  const segments = transcript.slice(0, 200);
  const numbered = segments
    .map((s) => `[${formatMmSs(s.start)}] ${s.text}`)
    .join("\n");

  const tasks: string[] = [];
  if (wantKeywords) {
    tasks.push(
      `1. 关键词（keywords）：从内容中提取 8-15 个最重要的关键词或专有名词，长度 2-12 字，不要带标点。`,
    );
  }
  if (wantQa) {
    tasks.push(
      `${wantKeywords ? "2" : "1"}. 问答对（qaPairs）：抽取 5-10 组高质量问答。每个 q 是一个清晰的问题（30 字内），a 是基于原文的精炼回答（80 字内），anchorTime 是回答中关键信息在视频中出现的秒数（整数，来自上面的时间戳，必填）。`,
    );
  }

  const wantedShape = [
    wantKeywords ? `"keywords": [string, ...]` : null,
    wantQa
      ? `"qaPairs": [{ "q": string, "a": string, "anchorTime": number }, ...]`
      : null,
  ]
    .filter(Boolean)
    .join(",\n  ");

  const prompt = `下面是一个视频的逐字稿（含时间戳）和已有概要，请你完成以下任务：

${tasks.join("\n")}

输出严格的 JSON：
{
  ${wantedShape}
}

【已有概要】
${summary || "（暂无）"}

【逐字稿】
${numbered}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是中文内容理解专家，输出严格的 JSON，按用户要求的字段填写。",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[enrich] LLM call failed", res.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: "AI enrich failed", detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { keywords?: unknown; qaPairs?: unknown } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON", raw: content.slice(0, 500) },
      { status: 502 },
    );
  }

  const nextAudio: AudioAnalysisResult = { ...audio };

  if (wantKeywords && Array.isArray(parsed.keywords)) {
    nextAudio.keywords = parsed.keywords
      .map((k) => String(k).trim())
      .filter((k) => k.length > 0 && k.length <= 20)
      .slice(0, 20);
  }

  if (wantQa && Array.isArray(parsed.qaPairs)) {
    nextAudio.qaPairs = parsed.qaPairs
      .map((qa) => {
        const obj = qa as { q?: unknown; a?: unknown; anchorTime?: unknown };
        const q = String(obj.q ?? "").trim();
        const a = String(obj.a ?? "").trim();
        const t = Number(obj.anchorTime);
        if (!q || !a) return null;
        return {
          q,
          a,
          anchorTime: Number.isFinite(t) && t >= 0 ? Math.floor(t) : undefined,
        };
      })
      .filter((qa): qa is NonNullable<typeof qa> => qa !== null)
      .slice(0, 15);
  }

  // audio_result 在数据库里是 jsonb；类型生成器把它表达成 Json，
  // 但 AudioAnalysisResult 是更窄的具名结构 → 直接绕过类型签名
  const { error: updateError } = await service
    .from("video_jobs")
    .update({ audio_result: JSON.parse(JSON.stringify(nextAudio)) })
    .eq("id", jobId);
  if (updateError) {
    console.error("[enrich] persist failed", updateError);
    return NextResponse.json(
      { error: "failed to persist enrichment" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    keywords: nextAudio.keywords,
    qaPairs: nextAudio.qaPairs,
  });
}

function formatMmSs(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
