"use client";

import { VideoPlayerCard } from "./VideoPlayerCard";
import { KeyframesGallery } from "./KeyframesGallery";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

/**
 * MainStage
 * - 视频详情页主区域：sticky 视频播放器 + 关键帧画廊（后续 Phase 还会加入更多模块）
 * - 自带 <main> 滚动容器，外层不要再包 <main>
 */
export function MainStage({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  return (
    <main className="overflow-y-auto overflow-x-hidden relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-track]:bg-transparent">
      {/* 内容容器：限制最大宽度让视频和关键帧统一对齐 */}
      <div className="mx-auto px-6 pt-4 pb-24 space-y-5 max-w-[960px]">
        <VideoPlayerCard note={note} />
        <KeyframesGallery videoJob={videoJob} />
      </div>
    </main>
  );
}
