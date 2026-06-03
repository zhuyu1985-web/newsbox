"use client";

import { useEffect, useRef, useState } from "react";
import { Download, AlertTriangle, ExternalLink, Chrome, RotateCw, Cog, AudioLines } from "lucide-react";
import { toast } from "sonner";
import { VideoPlayer } from "@/components/reader/ContentStage/VideoPlayer";
import { useVideoDetailStore } from "../store";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

/**
 * VideoPlayerCard
 * - 包装 VideoPlayer，使其在主区域顶部 sticky
 * - 通过 IntersectionObserver 检测离开视口，控制 MiniPlayer 显隐
 * - 监听 video:timeupdate / video:state 事件，同步到 Zustand store
 * - 视频下载/转码状态卡：pending/in_progress/failed/need_browser_fallback
 */
export function VideoPlayerCard({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  const setCurrentTime = useVideoDetailStore((s) => s.setCurrentTime);
  const setIsPlaying = useVideoDetailStore((s) => s.setIsPlaying);
  const setMiniPlayerVisible = useVideoDetailStore((s) => s.setMiniPlayerVisible);
  const audioMode = useVideoDetailStore((s) => s.audioMode);
  const ref = useRef<HTMLDivElement>(null);

  // IntersectionObserver — 视频离开视口时显示 MiniPlayer
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setMiniPlayerVisible(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [setMiniPlayerVisible]);

  // 监听 VideoPlayer 派发的事件，同步到 store
  useEffect(() => {
    const onTimeUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ time: number }>;
      if (typeof ce.detail?.time === "number") setCurrentTime(ce.detail.time);
    };
    const onState = (e: Event) => {
      const ce = e as CustomEvent<{ paused: boolean }>;
      setIsPlaying(!ce.detail.paused);
    };
    window.addEventListener("video:timeupdate", onTimeUpdate);
    window.addEventListener("video:state", onState);
    return () => {
      window.removeEventListener("video:timeupdate", onTimeUpdate);
      window.removeEventListener("video:state", onState);
    };
  }, [setCurrentTime, setIsPlaying]);

  // optimistic：用户点重试后立即把视图切到 "进行中"，等下一次刷新覆盖
  const [optimisticStep, setOptimisticStep] = useState<null | "download" | "transcode">(null);
  const status = videoJob?.download_status;
  const transcodeStatus = videoJob?.transcode_status;
  const sourceUrl = note.source_url;

  // 服务端已推进出 failed → 撤销 optimistic
  useEffect(() => {
    if (!optimisticStep) return;
    if (optimisticStep === "download" && status !== "failed") setOptimisticStep(null);
    if (optimisticStep === "transcode" && transcodeStatus !== "failed") setOptimisticStep(null);
  }, [optimisticStep, status, transcodeStatus]);

  // optimistic 下载重试 → 渲染下载中状态
  if (optimisticStep === "download") {
    return (
      <div ref={ref} className="aspect-video rounded-xl bg-card/40 backdrop-blur-xl border border-border/50 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 animate-[pulse_2.4s_ease-in-out_infinite]">
        <Download className="animate-pulse text-blue-500 dark:text-blue-400" size={28} />
        <div className="text-sm">已重新提交下载…</div>
      </div>
    );
  }
  // optimistic 转码重试
  if (optimisticStep === "transcode") {
    return (
      <div ref={ref} className="aspect-video rounded-xl bg-card/40 backdrop-blur-xl border border-border/50 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 animate-[pulse_2.4s_ease-in-out_infinite]">
        <Cog className="animate-spin text-blue-500 dark:text-blue-400" size={28} />
        <div className="text-sm">转码任务已提交，处理中…</div>
      </div>
    );
  }

  // 下载中
  if (videoJob && (status === "pending" || status === "in_progress")) {
    return (
      <div ref={ref} className="aspect-video rounded-xl bg-card/40 backdrop-blur-xl border border-border/50 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6">
        <Download className="animate-pulse text-blue-500 dark:text-blue-400" size={28} />
        <div className="text-sm">
          视频下载中
          {videoJob.size_bytes ? ` · ${Math.round(videoJob.size_bytes / 1024 / 1024)} MB` : ""}
          …
        </div>
        <div className="text-[11px]">这通常需要几秒到几分钟</div>
      </div>
    );
  }

  // 下载失败
  if (videoJob && status === "failed") {
    return (
      <div ref={ref} className="aspect-video rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60 flex flex-col items-center justify-center gap-3 text-rose-700 dark:text-rose-300 p-6">
        <AlertTriangle size={28} />
        <div className="text-sm">视频下载失败</div>
        {videoJob.download_error && (
          <div className="text-[11px] max-w-md text-center">{videoJob.download_error}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={async () => {
              setOptimisticStep("download");
              try {
                const res = await fetch(`/api/ai/video/${videoJob.id}/retry?step=download`, { method: "POST" });
                if (!res.ok) throw new Error("retry failed");
                toast.success("已重试下载");
              } catch (err) {
                setOptimisticStep(null);
                toast.error(err instanceof Error ? err.message : "重试失败");
              }
            }}
            className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs flex items-center gap-1"
          >
            <RotateCw size={12} />
            重试下载
          </button>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md border border-rose-300 dark:border-rose-700 text-xs flex items-center gap-1"
            >
              <ExternalLink size={12} />
              打开原始链接
            </a>
          )}
        </div>
      </div>
    );
  }

  // 转码失败
  if (videoJob && transcodeStatus === "failed") {
    return (
      <div ref={ref} className="aspect-video rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60 flex flex-col items-center justify-center gap-3 text-rose-700 dark:text-rose-300 p-6">
        <AlertTriangle size={28} />
        <div className="text-sm">视频转码失败</div>
        <div className="text-[11px] max-w-md text-center">
          可能由源文件编解码异常导致。可尝试重新转码；若仍失败请重新抓取。
        </div>
        <button
          onClick={async () => {
            setOptimisticStep("transcode");
            try {
              const res = await fetch(`/api/ai/video/${videoJob.id}/retry?step=transcode`, { method: "POST" });
              if (!res.ok) throw new Error("retry failed");
              toast.success("已重新提交转码");
            } catch (err) {
              setOptimisticStep(null);
              toast.error(err instanceof Error ? err.message : "重试失败");
            }
          }}
          className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs flex items-center gap-1"
        >
          <RotateCw size={12} />
          重新转码
        </button>
      </div>
    );
  }

  // 需要浏览器扩展辅助
  if (videoJob && status === "need_browser_fallback") {
    return (
      <div ref={ref} className="aspect-video rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 flex flex-col items-center justify-center gap-3 text-amber-800 dark:text-amber-300 p-6">
        <Chrome size={28} />
        <div className="text-sm">该站点需浏览器扩展辅助下载</div>
        <div className="text-[11px] max-w-md text-center">请在浏览器扩展里继续完成下载流程</div>
      </div>
    );
  }

  // audioMode：折叠视频，让顶部 MiniPlayer 接管音频条形态，但 VideoPlayer 节点保持挂载（保留播放）
  return (
    <div ref={ref}>
      {audioMode && (
        <div className="aspect-video rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/50 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <AudioLines className="text-blue-500 dark:text-blue-400" size={28} />
          <div className="text-sm">音频模式</div>
          <div className="text-[11px]">播放控制已上移至顶部</div>
        </div>
      )}
      <div
        className={
          audioMode
            ? "h-0 overflow-hidden invisible pointer-events-none"
            : "aspect-video rounded-xl overflow-hidden bg-black border border-border/50 shadow-sm"
        }
        aria-hidden={audioMode}
      >
        <VideoPlayer note={note as any} embedded aspectRatio="16:9" />
      </div>
    </div>
  );
}
