"use client";
import { useMemo } from "react";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { TranscriptSegment, AudioAnalysisResult } from "@/lib/ai-analysis/types";

const PALETTE = [
  "from-blue-400 to-blue-600",
  "from-cyan-400 to-cyan-600",
  "from-rose-400 to-rose-600",
  "from-amber-400 to-amber-600",
  "from-emerald-400 to-emerald-600",
];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

interface DerivedSummary {
  speakerId: string;
  label: string;
  firstAppearance: number;
  segmentCount: number;
  totalChars: number;
  highlight: string;
}

function deriveSummaries(
  transcript: TranscriptSegment[],
  speakers: AudioAnalysisResult["speakers"],
): DerivedSummary[] {
  const map = new Map<string, { segments: TranscriptSegment[]; chars: number }>();
  for (const seg of transcript) {
    const id = seg.speaker ?? "unknown";
    if (!map.has(id)) map.set(id, { segments: [], chars: 0 });
    const entry = map.get(id)!;
    entry.segments.push(seg);
    entry.chars += seg.text.length;
  }
  const out: DerivedSummary[] = [];
  for (const [id, { segments, chars }] of map) {
    if (id === "unknown") continue;
    const longest =
      [...segments].sort((a, b) => b.text.length - a.text.length).find((s) => s.text.length > 10) ??
      segments[0];
    out.push({
      speakerId: id,
      label: speakers?.find((sp) => sp.id === id)?.label ?? `发言人 ${id}`,
      firstAppearance: segments[0]?.start ?? 0,
      segmentCount: segments.length,
      totalChars: chars,
      highlight:
        (longest?.text ?? "").slice(0, 120) +
        (longest && longest.text.length > 120 ? "…" : ""),
    });
  }
  return out.sort((a, b) => a.firstAppearance - b.firstAppearance);
}

export function SpeakerSummaryTab({
  audio,
}: {
  audio: AudioAnalysisResult | null | undefined;
}) {
  const { seek } = useVideoSeek();

  // 优先使用 Tingwu 提供的 speakerSummaries（adapter 若未来支持可直接生效）
  const fromTingwu = audio?.speakerSummaries;

  const derived = useMemo(
    () => (fromTingwu ? null : deriveSummaries(audio?.transcript ?? [], audio?.speakers)),
    [fromTingwu, audio?.transcript, audio?.speakers],
  );

  if (fromTingwu?.length) {
    return (
      <div className="space-y-3">
        {fromTingwu.map((s, i) => {
          const speaker = audio?.speakers?.find((sp) => sp.id === s.speakerId);
          const gradient = PALETTE[i % PALETTE.length];
          return (
            <div
              key={s.speakerId}
              className="rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} text-white text-[10px] flex items-center justify-center font-bold`}
                >
                  {(speaker?.label ?? s.speakerId).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-foreground">
                  {speaker?.label ?? `发言人 ${s.speakerId}`}
                </span>
              </div>
              <ul className="text-sm text-foreground space-y-1.5 pl-8 list-disc list-outside">
                {s.points.map((p, k) => (
                  <li key={k}>{p}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  if (!derived?.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        暂无发言人信息
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground text-center pb-1">
        AI 总结暂未生成，以下为按发言人聚合的简要信息
      </div>
      {derived.map((s, i) => {
        const gradient = PALETTE[i % PALETTE.length];
        return (
          <div
            key={s.speakerId}
            className="rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} text-white text-[10px] flex items-center justify-center font-bold`}
                >
                  {s.label.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-foreground">{s.label}</span>
              </div>
              <button
                onClick={() => seek(s.firstAppearance)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                {formatTime(s.firstAppearance)} ↗
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">
              共 {s.segmentCount} 段 · 约 {s.totalChars} 字
            </div>
            <div className="text-sm text-foreground leading-relaxed">
              &ldquo;{s.highlight}&rdquo;
            </div>
          </div>
        );
      })}
    </div>
  );
}
