"use client";
import { Loader2, Sparkles } from "lucide-react";
import { useVideoDetailStore } from "../store";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { Chapter } from "@/lib/ai-analysis/types";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export function ChaptersTab({ chapters }: { chapters: Chapter[] | undefined }) {
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const { seek } = useVideoSeek();

  if (!chapters?.length) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-blue-100/70 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 via-white/80 to-cyan-50/60 dark:from-blue-950/30 dark:via-background/80 dark:to-cyan-950/20 px-5 py-8 text-center shadow-[0_12px_40px_rgba(37,99,235,0.08)]">
        <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.82)_45%,transparent_68%)] dark:bg-[linear-gradient(110deg,transparent_20%,rgba(147,197,253,0.12)_45%,transparent_68%)] animate-analysis-shimmer" />
        <div className="relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_0_28px_rgba(37,99,235,0.28)] animate-analysis-glow">
          <Sparkles size={16} className="animate-sparkle" />
        </div>
        <div className="relative flex items-center justify-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-200">
          <Loader2 size={14} className="animate-spin" />
          <span>AI 章节生成中...</span>
        </div>
        <div className="relative mt-2 text-xs text-muted-foreground">
          分析完成后会自动加载章节速览
        </div>
      </div>
    );
  }

  const isActive = (c: Chapter, idx: number) => {
    const next = chapters[idx + 1];
    return currentTime >= c.start && (next ? currentTime < next.start : true);
  };

  return (
    <div className="space-y-1">
      {chapters.map((c, i) => {
        const active = isActive(c, i);
        return (
          <button
            key={i}
            onClick={() => seek(c.start)}
            className={
              active
                ? "w-full flex gap-3 px-2 py-2 rounded bg-blue-50/80 dark:bg-blue-950/40 text-left"
                : "w-full flex gap-3 px-2 py-2 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-left"
            }
          >
            <div className="flex items-center gap-1.5 text-xs shrink-0 w-14">
              <span
                className={
                  active
                    ? "w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"
                    : "w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                }
              />
              <span
                className={
                  active
                    ? "text-blue-700 dark:text-blue-300 font-mono"
                    : "text-muted-foreground font-mono"
                }
              >
                {formatTime(c.start)}
              </span>
            </div>
            <div
              className={
                active
                  ? "flex-1 text-sm font-medium text-blue-700 dark:text-blue-200"
                  : "flex-1 text-sm text-foreground"
              }
            >
              {c.title}
            </div>
          </button>
        );
      })}
    </div>
  );
}
