"use client";
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
      <div className="text-sm text-muted-foreground text-center py-8">
        AI 章节生成中...
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
