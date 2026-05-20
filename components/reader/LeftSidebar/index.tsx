"use client";

import { PanelLeftClose } from "lucide-react";
import { ArticleOutline } from "./ArticleOutline";
import { VideoChapters } from "./VideoChapters";
import { Button } from "@/components/ui/button";
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
    <div className="relative h-full flex flex-col bg-transparent">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-20 h-8 w-8 rounded-md"
        onClick={onCollapse}
        title="收起左侧栏"
        aria-label="收起左侧栏"
      >
        <PanelLeftClose className="h-3.5 w-3.5" />
      </Button>

      {/* 侧栏内容 */}
      <div className="flex-1 overflow-y-auto pt-9">
        {note.content_type === "video" ? (
          <VideoChapters note={note} />
        ) : (
          <ArticleOutline
            noteId={note.id}
            title={note.title}
            excerpt={note.excerpt}
            siteName={note.site_name}
            publishedAt={note.published_at}
            contentHtml={note.content_html}
            contentText={note.content_text}
          />
        )}
      </div>
    </div>
  );
}
