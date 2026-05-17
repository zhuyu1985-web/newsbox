"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Note } from "@/components/reader/ReaderPageWrapper";
import type { TranscriptSegment } from "@/lib/ai-analysis/types";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptView({ note }: { note: Note }) {
  const noteId = note.id;

  // 优先读 video_job.audio_result.transcript
  const jobSegments = note.video_job?.audio_result?.transcript ?? null;

  // 当前播放时间（秒），用于高亮当前句子
  const [currentTime, setCurrentTime] = useState(0);

  // 如果 video_job 里没有 transcript，降级到旧的 transcripts 表（兼容）
  const [legacySegments, setLegacySegments] = useState<TranscriptSegment[] | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(!jobSegments);
  const [generating, setGenerating] = useState(false);

  // 监听视频播放时间
  useEffect(() => {
    const handleTimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ time: number }>;
      if (typeof customEvent.detail?.time === "number") {
        setCurrentTime(customEvent.detail.time);
      }
    };
    window.addEventListener("video:timeupdate", handleTimeUpdate);
    return () => window.removeEventListener("video:timeupdate", handleTimeUpdate);
  }, []);

  // 如果 video_job 没有 transcript，从旧 transcripts 表加载
  useEffect(() => {
    if (jobSegments) return;

    const loadLegacy = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transcripts")
        .select("segments")
        .eq("note_id", noteId)
        .single();

      if (!error && data?.segments) {
        setLegacySegments(data.segments as unknown as TranscriptSegment[]);
      }
      setLegacyLoading(false);
    };

    loadLegacy();
  }, [noteId, jobSegments]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const supabase = createClient();
      const { data: noteData } = await supabase
        .from("notes")
        .select("media_url")
        .eq("id", noteId)
        .single();

      if (!noteData?.media_url) {
        throw new Error("找不到视频/音频链接，无法转写");
      }

      const response = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, audioUrl: noteData.media_url }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setLegacySegments(data.segments);
      } else {
        throw new Error(data.error || "转写失败");
      }
    } catch (error: unknown) {
      console.error("Generate transcript error:", error);
      toast.error(error instanceof Error ? error.message : "转写失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleSegmentClick = (start: number) => {
    window.dispatchEvent(new CustomEvent("video:seek", { detail: { time: start } }));
  };

  // 确定最终要渲染的 segments
  const segments: TranscriptSegment[] | null = jobSegments ?? legacySegments;
  const loading = !jobSegments && legacyLoading;

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        加载逐字稿中...
      </div>
    );
  }

  if (!segments || segments.length === 0) {
    return (
      <div className="p-6 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">暂无逐字稿</p>
        <Button onClick={handleGenerate} disabled={generating}>
          <FileText className="h-4 w-4 mr-2" />
          {generating ? "ASR转写中..." : "生成逐字稿"}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      {segments.map((segment, index) => {
        const isActive = currentTime >= segment.start && currentTime < segment.end;
        return (
          <div
            key={index}
            onClick={() => handleSegmentClick(segment.start)}
            className={cn(
              "flex gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors",
              isActive
                ? "bg-yellow-100 dark:bg-yellow-900/30"
                : "hover:bg-muted/60"
            )}
          >
            {segment.speaker && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                说话人{segment.speaker}:
              </span>
            )}
            <span className={cn(
              "text-sm flex-1 leading-relaxed",
              isActive ? "text-yellow-900 dark:text-yellow-100" : "text-card-foreground"
            )}>
              {segment.text}
            </span>
            <span className="text-xs text-muted-foreground ml-auto shrink-0 mt-0.5 font-mono">
              {formatTime(segment.start)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
