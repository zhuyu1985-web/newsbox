"use client";
import { useEffect, useRef } from "react";
import { useVideoDetailStore } from "../store";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { TranscriptSegment } from "@/lib/ai-analysis/types";
import type { VideoJobRow } from "@/components/reader/ReaderPageWrapper";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
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
        const speakerLetter = seg.speaker?.slice(0, 1).toUpperCase() ?? "?";
        return (
          <div
            key={i}
            data-idx={i}
            data-time={seg.start}
            data-speaker={seg.speaker ?? ""}
            className={
              isActive
                ? "group bg-blue-50/80 dark:bg-blue-950/40 -mx-2 px-2 py-2 rounded-lg ring-1 ring-blue-200 dark:ring-blue-800/40"
                : "group"
            }
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
              {seg.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
