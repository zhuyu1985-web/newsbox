import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "node:fs";
import path from "node:path";

type ChatMessage = { role: "user" | "assistant"; content: string };

type EvidenceKind = "note" | "highlight" | "annotation" | "transcript" | "ai_output";

type EvidenceItem = {
  kind: EvidenceKind;
  noteId: string;
  sourceId: string;
  title?: string | null;
  sourceUrl?: string | null;
  siteName?: string | null;
  snippet: string;
};

function escapeForIlike(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeText(s: unknown) {
  return typeof s === "string" ? s : "";
}

function makeSnippet(text: string, query: string, maxLen = 420) {
  const t = text.trim();
  const q = query.trim();
  if (!t) return "";
  if (!q) return t.slice(0, maxLen);

  const lowerT = t.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerT.indexOf(lowerQ);
  if (idx === -1) return t.slice(0, maxLen);

  const start = Math.max(0, idx - Math.floor(maxLen * 0.3));
  const end = Math.min(t.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < t.length ? "…" : "";
  return `${prefix}${t.slice(start, end)}${suffix}`;
}

function readEnvLocalOpenAIKeyLast4(): string | null {
  try {
    const filePath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, "utf8");
    const line = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith("OPENAI_API_KEY="));
    if (!line) return null;
    const value = line.slice("OPENAI_API_KEY=".length).trim();
    return value ? value.slice(-4) : null;
  } catch {
    return null;
  }
}

function buildKnowledgeSystemPrompt(evidence: EvidenceItem[]) {
  const corpus = evidence
    .slice(0, 12)
    .map((e, idx) => {
      const headerParts = [
        `[#${idx + 1}]`,
        `[note:${e.noteId}]`,
        e.kind,
        e.title ? `title=${JSON.stringify(e.title)}` : "",
        e.siteName ? `site=${JSON.stringify(e.siteName)}` : "",
        e.sourceUrl ? `url=${JSON.stringify(e.sourceUrl)}` : "",
      ].filter(Boolean);

      return `${headerParts.join(" ")}` + `\n${e.snippet}`;
    })
    .join("\n\n---\n\n");

  return `你是 NewsBox 的知识库助手。你必须只基于“语料片段”来回答，禁止编造。

引用规则：当你陈述一个来自语料的事实/观点时，必须在句末附带引用标记，格式为 [note:<id>]（例如 [note:9b0a...]).
- 同一句可附多个引用。
- 如果语料不足以回答，就明确说“不确定/语料未提到”，并建议用户补充关键词。

输出要求：
- 用中文回答，尽量结构化（要点列表/小标题）。
- 优先回答用户问题，其次给出可能的延伸追问。

语料片段（已按你的账号隔离检索，可能不完整）：
${corpus.substring(0, 12000)}
`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : null;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages are required" }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m?.role === "user" && typeof m?.content === "string");
    const queryRaw = lastUser?.content ?? "";
    const query = queryRaw.trim();

    if (!query) {
      return NextResponse.json({ error: "latest user message is empty" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1) Retrieve evidence (P0 corpus)
    const qLike = `%${escapeForIlike(query)}%`;

    const [notesRes, highlightsRes, annotationsRes, transcriptsRes, aiOutputsRes] = await Promise.all([
      supabase
        .from("notes")
        .select("id, title, source_url, site_name, excerpt, content_text, updated_at, created_at")
        .eq("user_id", user.id)
        .or(
          [
            `title.ilike.${qLike}`,
            `excerpt.ilike.${qLike}`,
            `content_text.ilike.${qLike}`,
            `site_name.ilike.${qLike}`,
            `source_url.ilike.${qLike}`,
          ].join(","),
        )
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("highlights")
        .select("id, note_id, quote, created_at")
        .eq("user_id", user.id)
        .ilike("quote", qLike)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("annotations")
        .select("id, note_id, content, created_at")
        .eq("user_id", user.id)
        .ilike("content", qLike)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("transcripts")
        .select("id, note_id, full_text")
        .eq("user_id", user.id)
        .ilike("full_text", qLike)
        .limit(4),
      supabase
        .from("ai_outputs")
        .select("id, note_id, summary, transcript")
        .eq("user_id", user.id)
        .or([`summary.ilike.${qLike}`, `transcript.ilike.${qLike}`].join(","))
        .limit(6),
    ]);

    if (notesRes.error || highlightsRes.error || annotationsRes.error || transcriptsRes.error || aiOutputsRes.error) {
      console.error("/api/knowledge/chat retrieval errors", {
        notes: notesRes.error,
        highlights: highlightsRes.error,
        annotations: annotationsRes.error,
        transcripts: transcriptsRes.error,
        ai_outputs: aiOutputsRes.error,
      });
      return NextResponse.json({ error: "Retrieval failed" }, { status: 500 });
    }

    const evidence: EvidenceItem[] = [];

    for (const n of (notesRes.data ?? []) as any[]) {
      const baseText = normalizeText(n.excerpt) || normalizeText(n.content_text) || normalizeText(n.title);
      evidence.push({
        kind: "note",
        noteId: n.id,
        sourceId: n.id,
        title: n.title,
        sourceUrl: n.source_url,
        siteName: n.site_name,
        snippet: makeSnippet(baseText, query, 520),
      });
    }

    for (const h of (highlightsRes.data ?? []) as any[]) {
      evidence.push({
        kind: "highlight",
        noteId: h.note_id,
        sourceId: h.id,
        snippet: makeSnippet(normalizeText(h.quote), query, 420),
      });
    }

    for (const a of (annotationsRes.data ?? []) as any[]) {
      evidence.push({
        kind: "annotation",
        noteId: a.note_id,
        sourceId: a.id,
        snippet: makeSnippet(normalizeText(a.content), query, 520),
      });
    }

    for (const t of (transcriptsRes.data ?? []) as any[]) {
      evidence.push({
        kind: "transcript",
        noteId: t.note_id,
        sourceId: t.id,
        snippet: makeSnippet(normalizeText(t.full_text), query, 520),
      });
    }

    for (const o of (aiOutputsRes.data ?? []) as any[]) {
      const text = normalizeText(o.summary) || normalizeText(o.transcript);
      evidence.push({
        kind: "ai_output",
        noteId: o.note_id,
        sourceId: o.id,
        snippet: makeSnippet(text, query, 520),
      });
    }

    // Enrich title/url/siteName for non-note evidence.
    const needMetaNoteIds = Array.from(new Set(evidence.map((e) => e.noteId))).slice(0, 50);
    if (needMetaNoteIds.length > 0) {
      const noteMetaRes = await supabase
        .from("notes")
        .select("id, title, source_url, site_name")
        .eq("user_id", user.id)
        .in("id", needMetaNoteIds);

      if (noteMetaRes.error) {
        console.error("/api/knowledge/chat note meta error", noteMetaRes.error);
        return NextResponse.json(
          { error: "Retrieval failed", details: noteMetaRes.error },
          { status: 500 },
        );
      }

      const noteMetaMap = new Map<string, any>();
      for (const n of noteMetaRes.data ?? []) noteMetaMap.set(n.id, n);
      for (const e of evidence) {
        const meta = noteMetaMap.get(e.noteId);
        if (!e.title) e.title = meta?.title ?? null;
        if (!e.sourceUrl) e.sourceUrl = meta?.source_url ?? null;
        if (!e.siteName) e.siteName = meta?.site_name ?? null;
      }
    }

    // 2) Generate answer (streaming)
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = (process.env.OPENAI_MODEL || "gpt-4o").trim();

    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    if (process.env.NODE_ENV !== "production") {
      const envLocalLast4 = readEnvLocalOpenAIKeyLast4();
      const processLast4 = apiKey.slice(-4);
      if (envLocalLast4 && envLocalLast4 !== processLast4) {
        return NextResponse.json(
          {
            error: "OPENAI_API_KEY is overridden by process environment",
            details: {
              message:
                "当前 Next 进程读到的 OPENAI_API_KEY 与 .env.local 不一致。Next.js 默认不会用 .env.local 覆盖已存在的环境变量；请在启动 dev server 的终端/IDE 里清掉 OPENAI_API_KEY 后重启。",
            },
            provider: {
              baseUrl,
              model,
              apiKeyLast4: processLast4,
              envLocalApiKeyLast4: envLocalLast4,
            },
          },
          { status: 500 },
        );
      }
    }

    const systemPrompt = buildKnowledgeSystemPrompt(evidence);

    if (process.env.NODE_ENV !== "production") {
      const last4 = apiKey.slice(-4);
      console.log("[knowledge/chat] provider", {
        baseUrl,
        model,
        apiKeyLast4: last4,
      });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const provider =
        process.env.NODE_ENV !== "production"
          ? {
              baseUrl,
              model,
              apiKeyLast4: apiKey.slice(-4),
            }
          : undefined;

      return NextResponse.json(
        { error: "AI chat failed", details: error, provider },
        { status: response.status },
      );
    }

    // Directly proxy OpenAI SSE stream.
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error in /api/knowledge/chat:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
