"use client";
import { useState } from "react";
import { MessageCircleQuestion, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useVideoSeek } from "../hooks/useVideoSeek";
import { useVideoDetailStore } from "../store";
import { useMarkers, type MarkerKind } from "../hooks/useMarkers";
import { MarkerActionBar, getActiveKinds } from "../shared/MarkerActionBar";
import { MARKER_ROW_BG, MARKER_ROW_RING } from "../shared/marker-styles";
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
  noteId: string;
}

export function QATab({ qaPairs: qaFromAudio, jobId, canEnrich, noteId }: Props) {
  const { seekAndPlay } = useVideoSeek();
  const [enriching, setEnriching] = useState(false);
  const override = useVideoDetailStore((s) => s.audioOverrides.qaPairs);
  const mergeOverrides = useVideoDetailStore((s) => s.mergeAudioOverrides);
  const qaPairs = override ?? qaFromAudio;
  const { markers, createMarker, deleteMarker, clearMarkers } = useMarkers(noteId);

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
      toast.success("问答回顾生成完成");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成问答回顾失败");
    } finally {
      setEnriching(false);
    }
  };

  if (!qaPairs?.length) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-blue-100/70 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 via-white/80 to-cyan-50/60 dark:from-blue-950/30 dark:via-background/80 dark:to-cyan-950/20 px-5 py-7 text-center shadow-[0_12px_40px_rgba(37,99,235,0.08)]">
        <div className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.76)_45%,transparent_68%)] dark:bg-[linear-gradient(110deg,transparent_20%,rgba(147,197,253,0.1)_45%,transparent_68%)] animate-analysis-shimmer" />
        <div className="relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_0_28px_rgba(37,99,235,0.28)]">
          <MessageCircleQuestion size={17} />
        </div>
        <div className="relative text-sm font-medium text-blue-700 dark:text-blue-200">
          暂无问答回顾
        </div>
        <div className="relative mx-auto mt-2 max-w-[260px] text-xs leading-5 text-muted-foreground">
          听悟未返回问答对时，可基于逐字稿用 AI 提炼视频中的关键问题与回答。
        </div>
        {canEnrich && jobId && (
          <div className="relative mt-4 flex justify-center">
            <Button
              onClick={enrich}
              disabled={enriching}
              variant="glass"
              size="sm"
              className="h-8 px-3 text-xs"
            >
              {enriching ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {enriching ? "生成中..." : "用 AI 生成问答回顾"}
            </Button>
          </div>
        )}
        {!canEnrich && (
          <div className="relative mt-4 text-[11px] text-muted-foreground">
            逐字稿生成完成后可进行 AI 兜底提炼
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/35 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MessageCircleQuestion size={13} className="text-blue-500" />
          <span>已提炼 {qaPairs.length} 组问答回顾</span>
        </div>
        {canEnrich && jobId && (
          <Button
            onClick={enrich}
            disabled={enriching}
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-[11px]"
            title="基于逐字稿重新生成问答回顾"
          >
            {enriching ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Sparkles size={11} />
            )}
            {enriching ? "生成中..." : "重新生成"}
          </Button>
        )}
      </div>
      {qaPairs.map((qa, i) => {
        const hasAnchor = typeof qa.anchorTime === "number";
        const wholeKinds = getActiveKinds(markers, "qa", i);
        const firstKind = wholeKinds.values().next().value as MarkerKind | undefined;

        const handleCardClick = (e: React.MouseEvent) => {
          if (!hasAnchor) return;
          const sel = window.getSelection?.();
          if (sel && sel.toString().length > 0) return;
          if ((e.target as HTMLElement).closest("button")) return;
          seekAndPlay(qa.anchorTime!);
        };

        const handleToggleMarker = (kind: MarkerKind) => {
          if (wholeKinds.has(kind)) {
            const target = markers.find(
              (m) =>
                m.target_type === "qa" &&
                m.segment_idx === i &&
                m.marker_kind === kind &&
                m.selection_start == null,
            );
            if (target) deleteMarker(target.id);
            return;
          }
          createMarker({
            marker_kind: kind,
            target_type: "qa",
            segment_idx: i,
            anchor_time: typeof qa.anchorTime === "number" ? qa.anchorTime : undefined,
          });
        };

        const baseCls = firstKind
          ? `${MARKER_ROW_BG[firstKind]} ${MARKER_ROW_RING[firstKind]} border-border/40`
          : "border-border/50 bg-card/40";
        const interactiveCls = hasAnchor
          ? "cursor-pointer hover:border-blue-200/60 dark:hover:border-blue-800/40 transition-colors"
          : "";

        return (
          <div
            key={i}
            data-segment-idx={i}
            data-marker-target="qa"
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
            className={`group relative rounded-lg border backdrop-blur-md p-3 space-y-2 ${baseCls} ${interactiveCls}`}
          >
            <MarkerActionBar
              activeKinds={wholeKinds}
              onToggle={handleToggleMarker}
              onClear={() => clearMarkers({ target_type: "qa", segment_idx: i })}
            />
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                问
              </span>
              <div className="text-sm font-medium text-foreground leading-relaxed flex-1 select-text">
                {qa.q}
              </div>
              {hasAnchor && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    seekAndPlay(qa.anchorTime!);
                  }}
                  className="h-auto p-0 text-xs font-mono shrink-0"
                >
                  {formatTime(qa.anchorTime!)}
                </Button>
              )}
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-amber-100/80 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                答
              </span>
              <div className="text-sm text-muted-foreground leading-relaxed flex-1 select-text">
                {qa.a}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
