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
    <main className="overflow-y-auto relative">
      <div className="p-6 space-y-6 pb-24">
        <VideoPlayerCard note={note} />
        <KeyframesGallery videoJob={videoJob} />
      </div>
    </main>
  );
}
