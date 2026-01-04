import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EvidenceKind = "note" | "highlight" | "annotation" | "transcript" | "ai_output";

type EvidenceItem = {
  kind: EvidenceKind;
  noteId: string;
  sourceId: string;
  title?: string | null;
  sourceUrl?: string | null;
  siteName?: string | null;
  snippet: string;
  createdAt?: string;
  score: number;
};

function escapeForIlike(input: string) {
  // Escape LIKE wildcards. Postgres uses backslash as default escape.
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeText(s: unknown) {
  return typeof s === "string" ? s : "";
}

function makeSnippet(text: string, query: string, maxLen = 220) {
  const t = text.trim();
  const q = query.trim();
  if (!t) return "";
  if (!q) return t.slice(0, maxLen);

  const lowerT = t.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lowerT.indexOf(lowerQ);
  if (idx === -1) return t.slice(0, maxLen);

  const start = Math.max(0, idx - Math.floor(maxLen * 0.35));
  const end = Math.min(t.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < t.length ? "…" : "";
  return `${prefix}${t.slice(start, end)}${suffix}`;
}

function countOccurrences(text: string, query: string) {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!t || !q) return 0;
  return t.split(q).length - 1;
}

function kindWeight(kind: EvidenceKind) {
  switch (kind) {
    case "annotation":
      return 1.4;
    case "highlight":
      return 1.3;
    case "transcript":
      return 1.15;
    case "ai_output":
      return 1.0;
    case "note":
    default:
      return 0.9;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const queryRaw = typeof body?.query === "string" ? body.query : "";
    const query = queryRaw.trim();
    const limit = typeof body?.limit === "number" ? Math.min(Math.max(body.limit, 1), 50) : 24;

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const qLike = `%${escapeForIlike(query)}%`;

    const [notesRes, highlightsRes, annotationsRes, transcriptsRes, aiOutputsRes] = await Promise.all([
      supabase
        .from("notes")
        .select("id, title, source_url, site_name, excerpt, content_text, created_at, updated_at")
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
        .limit(12),
      supabase
        .from("highlights")
        .select("id, note_id, quote, timecode, created_at")
        .eq("user_id", user.id)
        .ilike("quote", qLike)
        .order("created_at", { ascending: false })
        .limit(16),
      supabase
        .from("annotations")
        .select("id, note_id, highlight_id, content, created_at")
        .eq("user_id", user.id)
        .ilike("content", qLike)
        .order("created_at", { ascending: false })
        .limit(16),
      supabase
        .from("transcripts")
        .select("id, note_id, full_text, created_at")
        .eq("user_id", user.id)
        .ilike("full_text", qLike)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("ai_outputs")
        .select("id, note_id, summary, transcript, created_at, updated_at")
        .eq("user_id", user.id)
        .or([`summary.ilike.${qLike}`, `transcript.ilike.${qLike}`].join(","))
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    if (notesRes.error || highlightsRes.error || annotationsRes.error || transcriptsRes.error || aiOutputsRes.error) {
      console.error("/api/knowledge/search errors", {
        notes: notesRes.error,
        highlights: highlightsRes.error,
        annotations: annotationsRes.error,
        transcripts: transcriptsRes.error,
        ai_outputs: aiOutputsRes.error,
      });
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const evidence: EvidenceItem[] = [];

    const notes = (notesRes.data ?? []) as any[];
    const highlights = (highlightsRes.data ?? []) as any[];
    const annotations = (annotationsRes.data ?? []) as any[];
    const transcripts = (transcriptsRes.data ?? []) as any[];
    const aiOutputs = (aiOutputsRes.data ?? []) as any[];

    // Build a note metadata lookup for non-note evidence.
    const noteIds = new Set<string>();
    for (const n of notes) noteIds.add(n.id);
    for (const h of highlights) noteIds.add(h.note_id);
    for (const a of annotations) noteIds.add(a.note_id);
    for (const t of transcripts) noteIds.add(t.note_id);
    for (const o of aiOutputs) noteIds.add(o.note_id);

    const noteIdList = Array.from(noteIds);
    if (noteIdList.length === 0) {
      return NextResponse.json({ query, evidence: [] });
    }

    const noteMetaRes = await supabase
      .from("notes")
      .select("id, title, source_url, site_name")
      .eq("user_id", user.id)
      .in("id", noteIdList);

    if (noteMetaRes.error) {
      console.error("/api/knowledge/search note meta error", noteMetaRes.error);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    const noteMetaMap = new Map<string, any>();
    for (const n of noteMetaRes.data ?? []) noteMetaMap.set(n.id, n);

    for (const n of notes) {
      const baseText = normalizeText(n.excerpt) || normalizeText(n.content_text) || normalizeText(n.title);
      const snippet = makeSnippet(baseText, query);
      const score = kindWeight("note") * (1 + countOccurrences(baseText, query));
      evidence.push({
        kind: "note",
        noteId: n.id,
        sourceId: n.id,
        title: n.title,
        sourceUrl: n.source_url,
        siteName: n.site_name,
        snippet,
        createdAt: n.updated_at || n.created_at,
        score,
      });
    }

    for (const h of highlights) {
      const meta = noteMetaMap.get(h.note_id);
      const text = normalizeText(h.quote);
      const snippet = makeSnippet(text, query);
      const score = kindWeight("highlight") * (1 + countOccurrences(text, query));
      evidence.push({
        kind: "highlight",
        noteId: h.note_id,
        sourceId: h.id,
        title: meta?.title ?? null,
        sourceUrl: meta?.source_url ?? null,
        siteName: meta?.site_name ?? null,
        snippet,
        createdAt: h.created_at,
        score,
      });
    }

    for (const a of annotations) {
      const meta = noteMetaMap.get(a.note_id);
      const text = normalizeText(a.content);
      const snippet = makeSnippet(text, query);
      const score = kindWeight("annotation") * (1 + countOccurrences(text, query));
      evidence.push({
        kind: "annotation",
        noteId: a.note_id,
        sourceId: a.id,
        title: meta?.title ?? null,
        sourceUrl: meta?.source_url ?? null,
        siteName: meta?.site_name ?? null,
        snippet,
        createdAt: a.created_at,
        score,
      });
    }

    for (const t of transcripts) {
      const meta = noteMetaMap.get(t.note_id);
      const text = normalizeText(t.full_text);
      const snippet = makeSnippet(text, query);
      const score = kindWeight("transcript") * (1 + countOccurrences(text, query));
      evidence.push({
        kind: "transcript",
        noteId: t.note_id,
        sourceId: t.id,
        title: meta?.title ?? null,
        sourceUrl: meta?.source_url ?? null,
        siteName: meta?.site_name ?? null,
        snippet,
        createdAt: t.created_at,
        score,
      });
    }

    for (const o of aiOutputs) {
      const meta = noteMetaMap.get(o.note_id);
      const text = normalizeText(o.summary) || normalizeText(o.transcript);
      const snippet = makeSnippet(text, query);
      const score = kindWeight("ai_output") * (1 + countOccurrences(text, query));
      evidence.push({
        kind: "ai_output",
        noteId: o.note_id,
        sourceId: o.id,
        title: meta?.title ?? null,
        sourceUrl: meta?.source_url ?? null,
        siteName: meta?.site_name ?? null,
        snippet,
        createdAt: o.updated_at || o.created_at,
        score,
      });
    }

    evidence.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      query,
      evidence: evidence.slice(0, limit),
    });
  } catch (error) {
    console.error("API Error in /api/knowledge/search:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
