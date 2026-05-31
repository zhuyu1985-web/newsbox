"use client";
import { useEffect, useRef } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useVideoDetailStore } from "../store";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { TranscriptSegment } from "@/lib/ai-analysis/types";
import type { VideoJobRow } from "@/components/reader/ReaderPageWrapper";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

function HighlightedText({
  text,
  query,
  isCurrent,
}: {
  text: string;
  query: string;
  isCurrent: boolean;
}) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (!lower.includes(q)) return <>{text}</>;
  const parts: Array<{ str: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push({ str: text.slice(i), hit: false });
      break;
    }
    if (idx > i) parts.push({ str: text.slice(i, idx), hit: false });
    parts.push({ str: text.slice(idx, idx + q.length), hit: true });
    i = idx + q.length;
  }
  return (
    <>
      {parts.map((p, k) =>
        p.hit ? (
          <mark
            key={k}
            className={
              isCurrent
                ? "bg-amber-300 dark:bg-amber-600 text-foreground rounded px-0.5"
                : "bg-amber-100/80 dark:bg-amber-900/40 text-foreground rounded px-0.5"
            }
          >
            {p.str}
          </mark>
        ) : (
          <span key={k}>{p.str}</span>
        ),
      )}
    </>
  );
}

function speakerColor(id: string | undefined): string {
  if (!id) return "from-slate-400 to-slate-600 dark:from-slate-500 dark:to-slate-700";
  const palette = [
    "from-blue-400 to-blue-600",
    "from-cyan-400 to-cyan-600",
    "from-rose-400 to-rose-600",
    "from-amber-400 to-amber-600",
    "from-emerald-400 to-emerald-600",
  ];
  const idx = id.charCodeAt(0) % palette.length;
  return palette[idx];
}

export function TranscriptPanel({
  videoJob,
}: {
  videoJob: VideoJobRow | null;
}) {
  const transcript: TranscriptSegment[] = videoJob?.audio_result?.transcript ?? [];
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  const selected = useVideoDetailStore((s) => s.selectedSpeakers);
  const searchQuery = useVideoDetailStore((s) => s.searchQuery);
  const searchMatches = useVideoDetailStore((s) => s.searchMatches);
  const searchCurrentMatch = useVideoDetailStore((s) => s.searchCurrentMatch);
  const { seek } = useVideoSeek();
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const lastUserScrollTimeRef = useRef(0);

  // 发言人筛选：空集合 = 显示全部；否则只显示选中的发言人；未标注 speaker 的句子始终保留
  const visibleSegments = transcript.filter((seg) => {
    if (selected.size === 0) return true;
    return seg.speaker ? selected.has(seg.speaker) : true;
  });

  // 找到当前句索引（基于可见片段）
  const activeIdx = visibleSegments.findIndex((s, i) => {
    const next = visibleSegments[i + 1];
    return currentTime >= s.start && (next ? currentTime < next.start : currentTime <= s.end);
  });

  // 当前搜索命中的 transcript 全量索引 → 映射到 visibleSegments 的下标
  const currentMatchTranscriptIdx =
    searchCurrentMatch >= 0 && searchCurrentMatch < searchMatches.length
      ? searchMatches[searchCurrentMatch]
      : -1;
  const currentMatchVisibleIdx =
    currentMatchTranscriptIdx >= 0
      ? visibleSegments.indexOf(transcript[currentMatchTranscriptIdx])
      : -1;

  // 自动滚动到当前句（除非用户在最近 5 秒内手动滚动过）
  useEffect(() => {
    if (activeIdx < 0) return;
    const since = Date.now() - lastUserScrollTimeRef.current;
    if (userScrolledRef.current && since < 5000) return;
    userScrolledRef.current = false;

    const node = containerRef.current?.querySelector(
      `[data-idx="${activeIdx}"]`,
    ) as HTMLElement | null;
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx]);

  // 搜索命中切换：滚动到命中片段 + 同步视频时间（让用户搜索导航优先于自动滚动）
  useEffect(() => {
    if (currentMatchTranscriptIdx < 0) return;
    const seg = transcript[currentMatchTranscriptIdx];
    if (!seg) return;

    // 阻止 currentTime 触发的自动滚动覆盖搜索跳转
    userScrolledRef.current = true;
    lastUserScrollTimeRef.current = Date.now();

    if (currentMatchVisibleIdx >= 0) {
      const node = containerRef.current?.querySelector(
        `[data-idx="${currentMatchVisibleIdx}"]`,
      ) as HTMLElement | null;
      if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    window.dispatchEvent(
      new CustomEvent("video:seek", {
        detail: { time: seg.start, autoplay: "preserve" },
      }),
    );
    // 依赖只在搜索命中实际变更时触发；transcript 引用稳定（来自父级）
  }, [currentMatchTranscriptIdx, currentMatchVisibleIdx, transcript]);

  // 检测用户手动滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      userScrolledRef.current = true;
      lastUserScrollTimeRef.current = Date.now();
    };
    el.addEventListener("wheel", onScroll, { passive: true });
    el.addEventListener("touchmove", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onScroll);
      el.removeEventListener("touchmove", onScroll);
    };
  }, []);

  // Loading 状态
  if (!videoJob) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 py-8 text-center">
        视频任务初始化中...
      </div>
    );
  }
  if (videoJob.audio_status === "failed") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={28} className="text-rose-500" />
        <div className="text-sm text-foreground">AI 分析失败</div>
        {videoJob.audio_error && (
          <div className="text-xs text-muted-foreground max-w-xs">{videoJob.audio_error}</div>
        )}
        <button
          onClick={async () => {
            await fetch(`/api/ai/video/${videoJob.id}/retry?step=audio`, { method: "POST" });
            toast.success("已重新提交分析任务");
          }}
          className="mt-1 px-3 py-1.5 rounded-md bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs flex items-center gap-1.5"
        >
          <RotateCw size={12} />
          重新分析
        </button>
      </div>
    );
  }
  if (videoJob.audio_status !== "done") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground px-4 py-8 text-center gap-2">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <div>字幕生成中，请稍候...</div>
      </div>
    );
  }
  if (transcript.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 py-8 text-center">
        该视频未生成字幕
      </div>
    );
  }
  if (visibleSegments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-4 py-8 text-center">
        当前筛选下没有可显示的发言内容
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent"
    >
      {visibleSegments.map((seg, i) => {
        const isActive = i === activeIdx;
        const isCurrentMatch = i === currentMatchVisibleIdx;
        const speakerLetter = seg.speaker?.slice(0, 1).toUpperCase() ?? "?";
        let containerCls = "group";
        if (isCurrentMatch) {
          containerCls =
            "group bg-amber-50/70 dark:bg-amber-950/30 -mx-2 px-2 py-2 rounded-lg ring-2 ring-amber-400 dark:ring-amber-600";
        } else if (isActive) {
          containerCls =
            "group bg-blue-50/80 dark:bg-blue-950/40 -mx-2 px-2 py-2 rounded-lg ring-1 ring-blue-200 dark:ring-blue-800/40";
        }
        return (
          <div
            key={i}
            data-idx={i}
            data-time={seg.start}
            data-speaker={seg.speaker ?? ""}
            className={containerCls}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${speakerColor(seg.speaker)} text-white text-[10px] flex items-center justify-center font-bold shrink-0`}
              >
                {speakerLetter}
              </div>
              <span
                className={
                  isActive
                    ? "text-xs text-blue-700 dark:text-blue-300 font-medium"
                    : "text-xs text-muted-foreground"
                }
              >
                {seg.speaker ? `发言人 ${seg.speaker}` : "发言人"}
                {isActive && <span className="ml-1.5">· 正在播放</span>}
              </span>
              <button
                onClick={() => seek(seg.start)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                {formatTime(seg.start)}
              </button>
            </div>
            <div className="text-sm text-foreground leading-relaxed pl-8 select-text">
              <HighlightedText
                text={seg.text}
                query={searchQuery}
                isCurrent={isCurrentMatch}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
