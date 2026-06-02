import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STYLE_PROMPTS: Record<string, string> = {
  conversational: "改写得更口语化、自然，像在聊天",
  formal: "改写得更书面、正式，适合发布",
  concise: "改写得更精简、提炼要点，去掉冗余",
  detailed: "在保留原意的前提下扩充更多细节和例子",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text, style } = (await req.json()) as { text: string; style: string };
  if (!text || typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "no text" }, { status: 400 });
  }
  if (!STYLE_PROMPTS[style]) {
    return NextResponse.json({ error: "invalid style" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    return NextResponse.json({ error: "ai service unavailable" }, { status: 503 });
  }

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
          content: `你是一个文字改写助手。请按要求改写用户输入的文本：${STYLE_PROMPTS[style]}。直接输出改写结果，不要加任何说明、引号、Markdown 包裹。`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "rewrite failed", detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }
  const json = await res.json();
  const rewritten = json?.choices?.[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ rewritten });
}
