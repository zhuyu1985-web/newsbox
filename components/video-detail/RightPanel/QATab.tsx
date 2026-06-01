"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { QAPair } from "@/lib/ai-analysis/types";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

interface Props {
  qaPairs: QAPair[] | undefined;
  jobId: string | null;
  canEnrich: boolean;
}

export function QATab({ qaPairs, jobId, canEnrich }: Props) {
  const { seekAndPlay } = useVideoSeek();
  const [enriching, setEnriching] = useState(false);

  const enrich = async () => {
    if (!jobId) return;
    setEnriching(true);
    try {
      const res = await fetch(`/api/ai/video/${jobId}/enrich?fields=qa`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "提取失败");
      }
      toast.success("问答对提取完成");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提取失败");
    } finally {
      setEnriching(false);
    }
  };

  if (!qaPairs?.length) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground text-center py-4">
          AI 暂未提炼出问答对
        </div>
        {canEnrich && jobId && (
          <div className="flex justify-center">
            <button
              onClick={enrich}
              disabled={enriching}
              className="px-3 py-1.5 rounded-md bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {enriching ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {enriching ? "提取中…" : "用 AI 提取"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {qaPairs.map((qa, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
              Q
            </span>
            <div className="text-sm text-foreground leading-relaxed flex-1">{qa.q}</div>
            {typeof qa.anchorTime === "number" && (
              <button
                onClick={() => seekAndPlay(qa.anchorTime!)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono shrink-0"
              >
                {formatTime(qa.anchorTime)}
              </button>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
              A
            </span>
            <div className="text-sm text-muted-foreground leading-relaxed flex-1">{qa.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
