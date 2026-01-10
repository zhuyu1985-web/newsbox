import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeForContains(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function isVerifiedQuote(sourceText: string, candidate: string) {
  const src = sourceText || "";
  const c = candidate.trim();
  if (!c) return false;
  if (c.length < 6) return false;
  if (c.length > 280) return false;

  if (src.includes(c)) return true;
  const srcN = normalizeForContains(src);
  const cN = normalizeForContains(c);
  if (!cN) return false;
  return srcN.includes(cN);
}

async function callOpenAIJson(args: { system: string; user: string; temperature?: number }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (process.env.OPENAI_MODEL || "gpt-4o").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: { type: "json_object" },
      temperature: args.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      detail = await response.text();
    }
    throw new Error(`OpenAI API failed with status ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content;
  if (!resultText) throw new Error("OpenAI API returned empty content");
  return { json: JSON.parse(resultText), model };
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
    const noteId = typeof body?.note_id === "string" ? body.note_id.trim() : "";
    const maxRaw = Number(body?.max ?? 8);
    const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 20) : 8;

    if (!noteId) {
      return NextResponse.json({ error: "缺少 note_id" }, { status: 400 });
    }

    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("id, title, content_text")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: "笔记不存在或无权访问" }, { status: 403 });
    }

    const sourceText = String(note.content_text || "").trim();
    if (!sourceText) {
      return NextResponse.json({ error: "该笔记没有可抽取的正文内容" }, { status: 400 });
    }

    const title = String(note.title || "").trim();
    const clipped = sourceText.slice(0, 15000);
    const promptVersion = "v1";

    const system = `你是一位资深记者与写作编辑，擅长从稿件中提炼可引用的“金句素材”。
你必须输出 JSON（json_object），字段如下：
- quotes: { content: string }[]  （返回 3~${max} 条）

规则：
1) 每条 content 必须是原文中的连续片段（逐字摘录），不可改写、不可拼接
2) 优先挑选：关键结论、核心观点、尖锐表述、关键数据结论句
3) 避免：过短口号、纯背景铺垫、无信息量语句
4) content 建议 12~80 字；不要包含书名号/引号外的多余解释
5) 输出必须是 JSON，不要 markdown 代码块`;

    const userPrompt = `标题：${title || "（无标题）"}
正文：\n${clipped}

请提炼金句素材。`;

    const { json, model } = await callOpenAIJson({ system, user: userPrompt, temperature: 0.2 });
    const rawQuotes = Array.isArray((json as any)?.quotes) ? (json as any).quotes : [];

    const seen = new Set<string>();
    const candidates: string[] = [];
    for (const it of rawQuotes) {
      const c = String(it?.content || "").trim();
      if (!c) continue;
      const key = normalizeForContains(c);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push(c);
      if (candidates.length >= max) break;
    }

    const verified: string[] = [];
    const rejected: string[] = [];
    for (const c of candidates) {
      if (isVerifiedQuote(sourceText, c)) verified.push(c);
      else rejected.push(c);
    }

    if (verified.length === 0) {
      return NextResponse.json({
        success: true,
        note_id: noteId,
        inserted: 0,
        candidates: candidates.length,
        verified: 0,
        rejected: rejected.length,
        items: [],
      });
    }

    const rows = verified.map((content) => ({
      user_id: user.id,
      note_id: noteId,
      content,
      source_type: "llm",
      source_meta: {
        model,
        prompt_version: promptVersion,
      },
    }));

    const upsert = await supabase
      .from("quote_materials")
      .upsert(rows, { onConflict: "user_id,note_id,content_hash", ignoreDuplicates: true })
      .select("id, note_id, content, source_type, created_at");

    if (upsert.error) {
      console.error("Extract quote_materials insert failed:", upsert.error);
      return NextResponse.json({ error: "入库失败", details: upsert.error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      note_id: noteId,
      inserted: (upsert.data || []).length,
      candidates: candidates.length,
      verified: verified.length,
      rejected: rejected.length,
      items: upsert.data || [],
    });
  } catch (error) {
    console.error("Extract quote_materials error:", error);
    return NextResponse.json(
      { error: "服务器错误", details: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}

