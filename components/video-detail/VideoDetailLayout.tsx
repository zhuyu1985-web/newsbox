"use client";

import { Search, Languages } from "lucide-react";
import { MainStage } from "./MainStage";
import { MiniPlayer } from "./MiniPlayer";
import { RightPanel } from "./RightPanel";
import { SelectionMenu } from "./shared/SelectionMenu";
import { SpeakerPopover } from "./SpeakerPopover";
import { AnalysisProgress } from "./AnalysisProgress";
import { LeftToolbar } from "./LeftToolbar";
import { SearchPopover } from "./SearchPopover";
import { TranslationPopover } from "./TranslationPopover";
import { MobileSheet } from "./MobileSheet";
import { MobileTabBar } from "./MobileTabBar";
import { MobileMoreMenu } from "./MobileMoreMenu";
import { BriefPanel } from "./RightPanel/BriefPanel";
import { TranscriptPanel } from "./RightPanel/TranscriptPanel";
import { NotesPanel } from "./RightPanel/NotesPanel";
import { useVideoDetailStore } from "./store";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

export function VideoDetailLayout({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  const mobileSheetOpen = useVideoDetailStore((s) => s.mobileSheetOpen);
  const setMobileSheetOpen = useVideoDetailStore((s) => s.setMobileSheetOpen);

  return (
    <>
      <div className="h-screen grid bg-background grid-cols-1 lg:grid-cols-[56px_1fr_420px] 2xl:grid-cols-[64px_1fr_480px]">
        {/* 左工具条 — 小屏隐藏，lg+ 显示。用 display:contents 让子组件继承 grid cell */}
        <div className="hidden lg:contents">
          <LeftToolbar noteId={note.id} isStarred={note.is_starred ?? false} />
        </div>

        {/* 主区域：顶栏 + 内容 — 任何屏幕都显示，移动端底部留出 56px 给 MobileTabBar */}
        <div className="flex flex-col overflow-hidden pb-14 lg:pb-0">
          {/* TopBar (Phase 8 占位) */}
          <header className="shrink-0 border-b border-border/50 bg-background/70 backdrop-blur-xl px-4 lg:px-6 h-14 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate text-foreground max-w-[150px] md:max-w-[240px] lg:max-w-none">
                {note.title ?? "未命名视频"}
              </h1>
              <div className="text-[11px] text-muted-foreground mt-0.5">已保存 · 刚刚</div>
            </div>
            <div className="relative flex items-center gap-1 text-muted-foreground shrink-0">
              <button
                onClick={() => useVideoDetailStore.getState().setSearchOpen(true)}
                className="w-8 h-8 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center"
                title="搜索原文"
              >
                <Search size={15} />
              </button>
              <button
                onClick={() => useVideoDetailStore.getState().setTranslationOpen(true)}
                className="w-8 h-8 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center"
                title="翻译"
              >
                <Languages size={15} />
              </button>
              {videoJob && <SpeakerPopover speakers={videoJob.audio_result?.speakers ?? []} />}
              {videoJob && <AnalysisProgress jobId={videoJob.id} />}
              <SearchPopover
                transcript={videoJob?.audio_result?.transcript ?? []}
                keywords={videoJob?.audio_result?.keywords}
              />
              <TranslationPopover transcript={videoJob?.audio_result?.transcript ?? []} />
            </div>
          </header>

          {/* 主区可滚动内容 */}
          <MainStage note={note} videoJob={videoJob} />
        </div>

        {/* 右栏 — 小屏隐藏，lg+ 显示 */}
        <div className="hidden lg:contents">
          <RightPanel note={note} videoJob={videoJob} />
        </div>
      </div>

      {/* MiniPlayer — 仅 lg+ 显示（移动端用 MobileTabBar 替代底部交互） */}
      <div className="hidden lg:contents">
        <MiniPlayer title={note.title ?? ""} duration={note.media_duration ?? 0} />
      </div>

      <SelectionMenu noteId={note.id} />

      {/* 移动端 UI — 仅 < lg 显示 */}
      <MobileTabBar />
      <MobileSheet
        open={mobileSheetOpen === "brief"}
        onClose={() => setMobileSheetOpen(null)}
        title="速览"
      >
        <BriefPanel videoJob={videoJob} />
      </MobileSheet>
      <MobileSheet
        open={mobileSheetOpen === "transcript"}
        onClose={() => setMobileSheetOpen(null)}
        title="原文"
      >
        <TranscriptPanel videoJob={videoJob} />
      </MobileSheet>
      <MobileSheet
        open={mobileSheetOpen === "notes"}
        onClose={() => setMobileSheetOpen(null)}
        title="笔记"
      >
        <NotesPanel
          noteId={note.id}
          initialContent={note.user_notes}
          initialUpdatedAt={note.user_notes_updated_at ?? null}
        />
      </MobileSheet>
      <MobileMoreMenu noteId={note.id} isStarred={note.is_starred ?? false} />
    </>
  );
}
