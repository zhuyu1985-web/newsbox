"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/components/reader/ReaderPageWrapper";
import type { Chapter } from "@/lib/ai-analysis/types";

interface VideoChaptersProps {
  note: Note;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoChapters({ note }: VideoChaptersProps) {
  const [activeStart, setActiveStart] = useState<number | null>(null);

  // 从 video_job.audio_result.chapters 读取章节
  const chapters: Chapter[] = note.video_job?.audio_result?.chapters ?? [];

  // 非视频笔记或者 video_job 不存在时早返
  if (note.content_type !== "video") {
    return null;
  }

  const handleChapterClick = (chapter: Chapter) => {
    setActiveStart(chapter.start);
    window.dispatchEvent(
      new CustomEvent("video:seek", { detail: { time: chapter.start } })
    );
  };

  if (chapters.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        章节生成中...
      </div>
    );
  }

  return (
    <div className="px-3 py-2 relative">
      {/* 竖向轴线 */}
      <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200/60 dark:bg-slate-700/60" />

      <ul className="space-y-1 relative">
        {chapters.map((chapter) => {
          const isActive = activeStart === chapter.start;

          return (
            <li key={chapter.start} className="relative">
              {/* 活动点指示器 */}
              {isActive && (
                <div className="absolute left-[13px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-800 ring-4 ring-slate-100 z-10 dark:bg-slate-200 dark:ring-slate-800" />
              )}

              <button
                onClick={() => handleChapterClick(chapter)}
                className={cn(
                  "w-full text-left py-2 pr-3 pl-8 transition-all duration-200 rounded-lg group flex flex-col gap-0.5",
                  isActive
                    ? "text-card-foreground bg-card shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                    : "text-muted-foreground hover:text-card-foreground hover:bg-muted/80"
                )}
              >
                <div className={cn(
                  "text-sm truncate",
                  isActive ? "font-semibold" : "font-medium"
                )}>
                  {chapter.title}
                </div>
                {chapter.summary && (
                  <div className="text-xs text-muted-foreground/70 line-clamp-2">
                    {chapter.summary}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(chapter.start)}</span>
                  <span className="opacity-30">-</span>
                  <span>{formatTime(chapter.end)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
