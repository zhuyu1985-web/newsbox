import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "md").toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: note, error } = await supabase
    .from("notes")
    .select("*, video_job:video_jobs(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !note) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const audio = (note.video_job as { audio_result?: AudioResult } | null)?.audio_result ?? null;
  const safeTitle = (note.title || "video").replace(/[^\w\u4e00-\u9fff -]/g, "_");

  if (format === "srt") {
    const srt = buildSrt(audio?.transcript ?? []);
    return new Response(srt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.srt`,
      },
    });
  }
  if (format === "json") {
    const body = JSON.stringify(note, null, 2);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.json`,
      },
    });
  }
  // md
  const md = buildMarkdown(note, audio);
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.md`,
    },
  });
}

interface TranscriptSeg {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}
interface ChapterSeg {
  start: number;
  end: number;
  title: string;
  summary?: string;
}
interface AudioResult {
  transcript?: TranscriptSeg[];
  chapters?: ChapterSeg[];
  summary?: string;
  keywords?: string[];
}

function pad(n: number, w = 2) {
  return n.toString().padStart(w, "0");
}
function formatMmSs(t: number) {
  return `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}`;
}
function formatSrtTime(t: number) {
  const h = pad(Math.floor(t / 3600));
  const m = pad(Math.floor((t % 3600) / 60));
  const s = pad(Math.floor(t % 60));
  const ms = pad(Math.floor((t % 1) * 1000), 3);
  return `${h}:${m}:${s},${ms}`;
}

function buildSrt(transcript: TranscriptSeg[]) {
  if (!transcript.length) return "";
  return transcript
    .map(
      (s, i) =>
        `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`,
    )
    .join("\n");
}

interface NoteRow {
  title?: string | null;
  source_url?: string | null;
  user_notes?: unknown;
}

function buildMarkdown(note: NoteRow, audio: AudioResult | null): string {
  const lines: string[] = [];
  lines.push(`# ${note.title || "未命名视频"}`);
  lines.push("");
  if (note.source_url) {
    lines.push(`**原始链接**：${note.source_url}`);
    lines.push("");
  }
  if (audio?.keywords?.length) {
    lines.push("## 关键词", "", audio.keywords.join(" · "), "");
  }
  if (audio?.summary) {
    lines.push("## 全文概要", "", audio.summary, "");
  }
  if (audio?.chapters?.length) {
    lines.push("## 章节速览", "");
    for (const c of audio.chapters) lines.push(`- **${formatMmSs(c.start)}** ${c.title}`);
    lines.push("");
  }
  if (audio?.transcript?.length) {
    lines.push("## 原文逐字稿", "");
    for (const s of audio.transcript) {
      const speaker = s.speaker ? ` 发言人 ${s.speaker}` : "";
      lines.push(`**[${formatMmSs(s.start)}]**${speaker} ${s.text}`);
      lines.push("");
    }
  }
  if (note.user_notes) {
    lines.push("## 我的笔记", "");
    lines.push(tiptapJsonToMarkdown(note.user_notes));
    lines.push("");
  }
  return lines.join("\n");
}

function tiptapJsonToMarkdown(json: unknown): string {
  if (!json) return "";
  return serialize(json as TiptapNode);
}

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
  content?: TiptapNode[];
}

function serialize(node: TiptapNode | null | undefined): string {
  if (!node) return "";
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map((n) => serialize(n)).join("\n\n");
    case "paragraph":
      return (node.content ?? []).map((n) => serialize(n)).join("");
    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const text = (node.content ?? []).map((n) => serialize(n)).join("");
      return `${"#".repeat(level)} ${text}`;
    }
    case "text": {
      let text = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "code") text = `\`${text}\``;
      }
      return text;
    }
    case "bulletList":
      return (node.content ?? [])
        .map(
          (li) =>
            `- ${(li.content ?? []).map((n) => serialize(n)).join(" ")}`,
        )
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map(
          (li, i) =>
            `${i + 1}. ${(li.content ?? []).map((n) => serialize(n)).join(" ")}`,
        )
        .join("\n");
    case "listItem":
      return (node.content ?? []).map((n) => serialize(n)).join("");
    case "timeReference": {
      const t = (node.attrs?.videoTime as number) ?? 0;
      const speakerLabel = node.attrs?.speakerLabel as string | undefined;
      const excerpt = (node.attrs?.excerpt as string) ?? "";
      const speaker = speakerLabel ? `(${speakerLabel}) ` : "";
      return `> **[${formatMmSs(t)}]** ${speaker}${excerpt}`;
    }
    case "keyframeReference": {
      const ts = (node.attrs?.timestamp as number) ?? 0;
      const imageUrl = (node.attrs?.imageUrl as string) ?? "";
      return `![关键帧 ${formatMmSs(ts)}](${imageUrl})`;
    }
    case "horizontalRule":
      return "---";
    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    default:
      return Array.isArray(node.content)
        ? node.content.map((n) => serialize(n)).join("")
        : "";
  }
}
