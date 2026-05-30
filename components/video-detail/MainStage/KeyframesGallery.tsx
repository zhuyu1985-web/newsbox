"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/reader/ImageLightbox";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { VideoJobRow } from "@/components/reader/ReaderPageWrapper";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

/**
 * KeyframesGallery
 * - 展示视频关键帧画廊（来自 video_jobs.frames）
 * - 叠加 visual_result[i].sceneDescription 描述
 * - 点击：跳转到对应时间戳 + 打开 Lightbox
 * - frame_status 未完成时显示骨架占位
 */
export function KeyframesGallery({ videoJob }: { videoJob: VideoJobRow | null }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const { seek } = useVideoSeek();

  const frames = videoJob?.frames ?? [];
  const visual = videoJob?.visual_result ?? [];

  // 关键帧抽取尚未完成 → 显示骨架
  // 兼容：visual_status 是 video_jobs 中的统一状态字段，frames 数据本身依赖于 visual / frame pipeline
  const framesReady = Array.isArray(frames) && frames.length > 0;

  if (!videoJob || !framesReady) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
        <h2 className="font-semibold mb-4">关键帧画廊</h2>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">正在抽取关键帧...</p>
      </section>
    );
  }

  return (
    <>
      <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">关键帧画廊</h2>
          <span className="text-xs text-slate-400">共 {frames.length} 帧</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {frames.map((f, i) => {
            const desc = visual[i]?.sceneDescription ?? "";
            return (
              <button
                key={`${f.timestamp}-${i}`}
                onClick={() => {
                  seek(f.timestamp);
                  setLightboxIdx(i);
                }}
                className="group relative aspect-video rounded-lg overflow-hidden bg-slate-100 hover:ring-2 hover:ring-violet-400 transition"
                aria-label={`跳转到 ${formatTime(f.timestamp)}`}
              >
                <img
                  src={f.url}
                  alt={desc}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {formatTime(f.timestamp)}
                </div>
                {desc && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-end p-2 text-white text-[11px] opacity-0 group-hover:opacity-100">
                    {desc}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {lightboxIdx !== null && (
        <ImageLightbox
          images={frames.map((f, i) => ({
            src: f.url,
            alt: visual[i]?.sceneDescription ?? `frame-${i + 1}`,
            caption: visual[i]?.sceneDescription,
          }))}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}
