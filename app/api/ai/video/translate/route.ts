import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LANG_NAMES: Record<string, string> = {
  en: "英文 (English)",
  ja: "日本語",
  ko: "한국어",
  "auto-zh": "中文（如果源语言非中文）",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { texts, targetLang } = (await req.json()) as {
    texts: string[];
    targetLang: string;
  };

  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: "no texts" }, { status: 400 });
  }
  if (!LANG_NAMES[targetLang]) {
    return NextResponse.json({ error: "invalid targetLang" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    return NextResponse.json(
      { error: "translation service unavailable" },
      { status: 503 },
    );
  }

  // 用 JSON 模式批量翻译，一次请求 30 段，避免超时
  const BATCH = 30;
  const all: string[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const numbered = batch.map((t, idx) => `[${idx}] ${t}`).join("\n");
    const prompt = `请将以下编号文本翻译为${LANG_NAMES[targetLang]}，**只翻译内容，保留原编号顺序**，输出严格的 JSON 数组（每元素一个字符串）。

原文：
${numbered}

输出格式：{"translations": ["译文 0", "译文 1", ...]}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是专业翻译，输出严格的 JSON。" },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "translation failed", detail: text.slice(0, 500) },
        { status: 502 },
      );
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { translations?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // fallback: return original
    }
    const translations = Array.isArray(parsed.translations) ? parsed.translations : [];
    for (let k = 0; k < batch.length; k++) {
      all.push(translations[k] ?? batch[k]);
    }
  }

  return NextResponse.json({ translations: all });
}
