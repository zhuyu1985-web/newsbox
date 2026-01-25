"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";

interface Transcript {
  id: string;
  full_text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  status: string;
}

export function TranscriptView({ noteId }: { noteId: string }) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadTranscript();
  }, [noteId]);

  const loadTranscript = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transcripts")
      .select("*")
      .eq("note_id", noteId)
      .single();

    if (!error && data) {
      setTranscript(data);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!noteId) return;
    
    setGenerating(true);
    try {
      // 首先获取笔记详情以拿到 media_url
      const supabase = createClient();
      const { data: note } = await supabase
        .from("notes")
        .select("media_url")
        .eq("id", noteId)
        .single();

      if (!note?.media_url) {
        throw new Error("找不到视频/音频链接，无法转写");
      }

      const response = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId,
          audioUrl: note.media_url,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTranscript({
          id: data.id,
          full_text: data.fullText,
          segments: data.segments,
          status: "completed",
        });
      } else {
        throw new Error(data.error || "转写失败");
      }
    } catch (error: any) {
      console.error("Generate transcript error:", error);
      toast.error(error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSegmentClick = (start: number) => {
    window.dispatchEvent(new CustomEvent("video:seek", {
      detail: { time: start }
    }));
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        加载逐字稿中...
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="p-6 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">
          暂无逐字稿
        </p>
        <Button onClick={handleGenerate} disabled={generating}>
          <FileText className="h-4 w-4 mr-2" />
          {generating ? "ASR转写中..." : "生成逐字稿"}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {transcript.segments.map((segment, index) => (
        <div
          key={index}
          className="p-3 rounded-lg hover:bg-muted dark:hover:bg-slate-800 border border-transparent hover:border-border dark:hover:border-slate-700 transition-colors cursor-pointer group"
          onClick={() => handleSegmentClick(segment.start)}
        >
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-mono text-muted-foreground/70 dark:text-muted-foreground shrink-0 mt-1 bg-muted dark:bg-slate-800 px-1.5 py-0.5 rounded group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              {Math.floor(segment.start / 60).toString().padStart(2, "0")}:
              {Math.floor(segment.start % 60).toString().padStart(2, "0")}
            </span>
            <p className="text-sm text-card-foreground dark:text-muted-foreground/70 group-hover:text-card-foreground dark:group-hover:text-slate-200 leading-relaxed">{segment.text}</p>
          </div>
          {segment.speaker && (
            <div className="text-[10px] font-medium text-blue-400 dark:text-blue-500 mt-2 ml-14">发言人: {segment.speaker}</div>
          )}
        </div>
      ))}
    </div>
  );
}

