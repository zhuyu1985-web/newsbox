"use client";

import { MainStage } from "./MainStage";
import { MiniPlayer } from "./MiniPlayer";
import { RightPanel } from "./RightPanel";
import { SelectionMenu } from "./shared/SelectionMenu";
import { SpeakerPopover } from "./SpeakerPopover";
import { AnalysisProgress } from "./AnalysisProgress";
import { LeftToolbar } from "./LeftToolbar";
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
        {/* 左工具条 — 接入功能：返回 / 收藏 / 导出 / 更多(删除) */}
        <LeftToolbar noteId={note.id} isStarred={note.is_starred ?? false} />

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
