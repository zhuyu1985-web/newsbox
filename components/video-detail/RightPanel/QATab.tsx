"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoSeek } from "../hooks/useVideoSeek";
import { useVideoDetailStore } from "../store";
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

export function QATab({ qaPairs: qaFromAudio, jobId, canEnrich }: Props) {
  const { seekAndPlay } = useVideoSeek();
  const [enriching, setEnriching] = useState(false);
  const override = useVideoDetailStore((s) => s.audioOverrides.qaPairs);
  const mergeOverrides = useVideoDetailStore((s) => s.mergeAudioOverrides);
  const qaPairs = override ?? qaFromAudio;

  const enrich = async () => {
    if (!jobId) return;
    setEnriching(true);
    try {
      const res = await fetch(`/api/ai/video/${jobId}/enrich?fields=qa`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "提取失败");
      if (Array.isArray(json.qaPairs)) {
        mergeOverrides({ qaPairs: json.qaPairs });
      }
      toast.success("问答对提取完成");
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
      {qaPairs.map((qa, i) => {
        const hasAnchor = typeof qa.anchorTime === "number";
        const handleCardClick = (e: React.MouseEvent) => {
          if (!hasAnchor) return;
          // 选中文字时不触发跳转
          const sel = window.getSelection?.();
          if (sel && sel.toString().length > 0) return;
          if ((e.target as HTMLElement).closest("button")) return;
          seekAndPlay(qa.anchorTime!);
        };
        return (
          <div
            key={i}
            onClick={handleCardClick}
            role={hasAnchor ? "button" : undefined}
            tabIndex={hasAnchor ? 0 : undefined}
            onKeyDown={(e) => {
              if (!hasAnchor) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                seekAndPlay(qa.anchorTime!);
              }
            }}
            aria-label={hasAnchor ? `跳转并播放 ${formatTime(qa.anchorTime!)}` : undefined}
            className={
              hasAnchor
                ? "rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3 space-y-2 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 hover:border-blue-200/60 dark:hover:border-blue-800/40 transition-colors"
                : "rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3 space-y-2"
            }
          >
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                Q
              </span>
              <div className="text-sm text-foreground leading-relaxed flex-1">{qa.q}</div>
              {hasAnchor && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    seekAndPlay(qa.anchorTime!);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono shrink-0"
                >
                  {formatTime(qa.anchorTime!)}
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
        );
      })}
    </div>
  );
}
