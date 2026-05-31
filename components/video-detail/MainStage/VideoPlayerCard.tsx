"use client";

import { useEffect, useRef } from "react";
import { VideoPlayer } from "@/components/reader/ContentStage/VideoPlayer";
import { useVideoDetailStore } from "../store";
import type { Note } from "@/components/reader/ReaderPageWrapper";

/**
 * VideoPlayerCard
 * - 包装 VideoPlayer，使其在主区域顶部 sticky
 * - 通过 IntersectionObserver 检测离开视口，控制 MiniPlayer 显隐
 * - 监听 video:timeupdate / video:state 事件，同步到 Zustand store
 */
export function VideoPlayerCard({ note }: { note: Note }) {
  const setCurrentTime = useVideoDetailStore((s) => s.setCurrentTime);
  const setIsPlaying = useVideoDetailStore((s) => s.setIsPlaying);
  const setMiniPlayerVisible = useVideoDetailStore((s) => s.setMiniPlayerVisible);
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

  return (
    <div
      ref={ref}
      className="sticky top-0 z-20 -mx-6 px-6 pt-2 pb-3 bg-slate-50 dark:bg-slate-950"
    >
      <VideoPlayer note={note as any} embedded />
    </div>
  );
}
