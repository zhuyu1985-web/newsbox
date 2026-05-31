"use client";

import { ArrowLeft, Save, Download, Share2, Star, MoreHorizontal } from "lucide-react";
import { MainStage } from "./MainStage";
import { MiniPlayer } from "./MiniPlayer";
import { RightPanel } from "./RightPanel";
import { SelectionMenu } from "./shared/SelectionMenu";
import { SpeakerPopover } from "./SpeakerPopover";
import { AnalysisProgress } from "./AnalysisProgress";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

export function VideoDetailLayout({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  return (
    <>
      <div
        className="h-screen grid bg-background"
        style={{ gridTemplateColumns: "64px 1fr 480px" }}
      >
        {/* 左工具条 (Phase 9 占位 — 图标已可见但暂未接入功能) */}
        <aside className="border-r border-border/50 bg-card/40 backdrop-blur-xl flex flex-col items-center py-3 gap-1 text-muted-foreground">
          <button className="w-11 h-11 rounded-lg hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center" title="返回">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-px bg-border my-2" />
          {[
            { Icon: Save, label: "保存" },
            { Icon: Download, label: "导出" },
            { Icon: Share2, label: "分享" },
            { Icon: Star, label: "收藏" },
            { Icon: MoreHorizontal, label: "更多" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              className="w-11 h-11 rounded-lg hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex flex-col items-center justify-center gap-0.5 text-[10px]"
              title={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        {/* 主区域：顶栏 + 内容 */}
        <div className="flex flex-col overflow-hidden">
          {/* TopBar (Phase 8 占位) */}
          <header className="shrink-0 border-b border-border/50 bg-background/70 backdrop-blur-xl px-6 h-14 flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate text-foreground">
                {note.title ?? "未命名视频"}
              </h1>
              <div className="text-[11px] text-muted-foreground mt-0.5">已保存 · 刚刚</div>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              {videoJob && <SpeakerPopover speakers={videoJob.audio_result?.speakers ?? []} />}
              {videoJob && <AnalysisProgress jobId={videoJob.id} />}
            </div>
          </header>

          {/* 主区可滚动内容 */}
          <MainStage note={note} videoJob={videoJob} />
        </div>

        {/* 右栏 (Phase 4-7) */}
        <RightPanel note={note} videoJob={videoJob} />
      </div>
      <MiniPlayer title={note.title ?? ""} duration={note.media_duration ?? 0} />
      <SelectionMenu />
    </>
  );
}
