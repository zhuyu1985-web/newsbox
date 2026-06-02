"use client";

import { useState } from "react";
import { Plus, AlertCircle, RotateCw, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/reader/ImageLightbox";
import { useVideoSeek } from "../hooks/useVideoSeek";
import { useVideoDetailStore } from "../store";
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
 * - hover：显示 "+ 加到笔记" 按钮，插入 keyframeReference 节点
 * - frame_status 未完成时显示骨架占位
 */
export function KeyframesGallery({ videoJob }: { videoJob: VideoJobRow | null }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const { seekAndPlay } = useVideoSeek();
  const editor = useVideoDetailStore((s) => s.notesEditor);
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);

  const frames = videoJob?.frames ?? [];
  const visual = videoJob?.visual_result ?? [];

  const addToNotes = (
    frame: { timestamp: number; url: string },
    desc: string,
  ) => {
    if (!editor) return;
    setActiveTab("notes");
    setTimeout(() => {
      editor.commands.focus("end");
      editor.commands.insertContent({
        type: "keyframeReference",
        attrs: {
          timestamp: frame.timestamp,
          imageUrl: frame.url,
          sceneDescription: desc,
        },
      });
      editor.commands.createParagraphNear();
    }, 50);
  };

  // 关键帧抽取失败
  if (videoJob?.frame_status === "failed") {
    return (
      <section className="bg-card/40 backdrop-blur-xl rounded-xl p-5 border border-border/50">
        <h2 className="font-semibold mb-4 text-foreground">关键帧画廊</h2>
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <AlertCircle size={24} className="text-rose-500" />
          <div className="text-sm text-muted-foreground">关键帧抽取失败</div>
          <button
            onClick={async () => {
              await fetch(`/api/ai/video/${videoJob.id}/retry?step=frame`, { method: "POST" });
              toast.success("已重试");
            }}
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <RotateCw size={10} />
            重试
          </button>
        </div>
      </section>
    );
  }

  // 关键帧抽取尚未完成 → 显示骨架
  // 兼容：visual_status 是 video_jobs 中的统一状态字段，frames 数据本身依赖于 visual / frame pipeline
  const framesReady = Array.isArray(frames) && frames.length > 0;

  if (!videoJob || !framesReady) {
    return (
      <section className="bg-card/80 dark:bg-card/60 backdrop-blur-xl rounded-xl p-5 border border-border/50">
        <h2 className="font-semibold mb-4 text-foreground">关键帧画廊</h2>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video bg-muted rounded-lg animate-pulse"
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">正在抽取关键帧...</p>
      </section>
    );
  }

  return (
    <>
      <section className="bg-card/80 dark:bg-card/60 backdrop-blur-xl rounded-xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">关键帧画廊</h2>
          <span className="text-xs text-muted-foreground">共 {frames.length} 帧</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {frames.map((f, i) => {
            const desc = visual[i]?.sceneDescription ?? "";
            const activate = () => {
              seekAndPlay(f.timestamp);
            };
            const openLightbox = (e: React.MouseEvent | React.KeyboardEvent) => {
              e.stopPropagation();
              setLightboxIdx(i);
            };
            return (
              <div
                key={`${f.timestamp}-${i}`}
                role="button"
                tabIndex={0}
                onClick={activate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activate();
                  }
                }}
                className="group relative aspect-video rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-blue-400 dark:hover:ring-blue-500 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`跳转并播放 ${formatTime(f.timestamp)}`}
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
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={openLightbox}
                    className="w-6 h-6 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center shadow-md"
                    title="放大查看"
                    aria-label="放大查看"
                  >
                    <Maximize2 size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToNotes(f, desc);
                    }}
                    className="w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 shadow-md"
                    title="加到笔记"
                    aria-label="加到笔记"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
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
