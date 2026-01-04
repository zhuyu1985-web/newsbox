"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Chapter {
  id: string;
  title: string;
  start_time: number;
  end_time: number | null;
  position: number;
  generated_by_ai: boolean;
  confidence_score: number | null;
}

interface VideoChaptersProps {
  noteId: string;
}

export function VideoChapters({ noteId }: VideoChaptersProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeChapter, setActiveChapter] = useState<string>("");

  useEffect(() => {
    loadChapters();
  }, [noteId]);

  const loadChapters = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("video_chapters")
      .select("*")
      .eq("note_id", noteId)
      .order("position", { ascending: true });

    if (!error && data) {
      setChapters(data);
    }
    setLoading(false);
  };

  const handleGenerateChapters = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });

      if (response.ok) {
        await loadChapters();
      } else {
        alert("生成章节失败");
      }
    } catch (error) {
      console.error("Generate chapters error:", error);
      alert("生成章节失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleChapterClick = (chapter: Chapter) => {
    // TODO: 触发视频跳转到对应时间
    setActiveChapter(chapter.id);
    window.dispatchEvent(
      new CustomEvent("video-seek", { detail: { time: chapter.start_time } })
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground text-center">
          暂无章节信息
        </p>
        <Button
          onClick={handleGenerateChapters}
          disabled={generating}
          className="w-full"
          size="sm"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {generating ? "AI生成中..." : "AI生成章节"}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 relative">
      {/* 竖向轴线 */}
      <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200/60" />

      <ul className="space-y-1 relative">
        {chapters.map((chapter) => {
          const isActive = activeChapter === chapter.id;
          
          return (
            <li key={chapter.id} className="relative">
              {/* 活动点指示器 */}
              {isActive && (
                <div className="absolute left-[13px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-800 ring-4 ring-slate-100 z-10" />
              )}
              
              <button
                onClick={() => handleChapterClick(chapter)}
                className={cn(
                  "w-full text-left py-2 pr-3 pl-8 transition-all duration-200 rounded-lg group flex items-start gap-3",
                  isActive
                    ? "text-slate-900 bg-white shadow-sm ring-1 ring-slate-200/50"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/80"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm truncate",
                    isActive ? "font-semibold" : "font-medium"
                  )}>
                    {chapter.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(chapter.start_time)}</span>
                    {chapter.end_time && (
                      <>
                        <span className="opacity-30">|</span>
                        <span>{formatTime(chapter.end_time)}</span>
                      </>
                    )}
                  </div>
                </div>
                {chapter.generated_by_ai && (
                  <Sparkles className={cn(
                    "h-3 w-3 shrink-0 mt-1",
                    isActive ? "text-pink-500" : "text-slate-300 group-hover:text-pink-400"
                  )} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

