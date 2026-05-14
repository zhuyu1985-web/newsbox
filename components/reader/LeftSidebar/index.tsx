"use client";

import { ArticleOutline } from "./ArticleOutline";
import { VideoChapters } from "./VideoChapters";
import type { Note } from "@/components/reader/ReaderPageWrapper";

interface LeftSidebarProps {
  note: Note;
  currentView: "reader" | "web" | "ai-brief" | "archive";
  onCollapse: () => void;
}

export function LeftSidebar({ note, currentView, onCollapse }: LeftSidebarProps) {
  // 只在沉浸阅读模式显示侧栏
  if (currentView !== "reader") {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* 侧栏头部 */}
      <div className="flex items-center justify-between px-6 py-10">
        <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
          {note.content_type === "video" ? "Chapters" : "Outline"}
        </h3>
      </div>

      {/* 侧栏内容 */}
      <div className="flex-1 overflow-y-auto">
        {note.content_type === "video" ? (
          <VideoChapters note={note} />
        ) : (
          <ArticleOutline content={note.content_html} />
        )}
      </div>
    </div>
  );
}

