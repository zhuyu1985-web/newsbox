"use client";

import { useState } from "react";
import { Search, Languages, AudioLines, Video as VideoIcon, Filter } from "lucide-react";
import { MainStage } from "./MainStage";
import { TitleEditor } from "./TitleEditor";
import { ExcerptButton } from "./ExcerptButton";
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
import { TranscriptMarkerFilterPopover } from "./TranscriptMarkerFilterPopover";
import { BriefPanel } from "./RightPanel/BriefPanel";
import { TranscriptPanel } from "./RightPanel/TranscriptPanel";
import { NotesPanel } from "./RightPanel/NotesPanel";
import { QATab } from "./RightPanel/QATab";
import { useVideoDetailStore } from "./store";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

export function VideoDetailLayout({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const mobileSheetOpen = useVideoDetailStore((s) => s.mobileSheetOpen);
  const setMobileSheetOpen = useVideoDetailStore((s) => s.setMobileSheetOpen);
  const audioMode = useVideoDetailStore((s) => s.audioMode);
  const setAudioMode = useVideoDetailStore((s) => s.setAudioMode);
  const showMarkedTranscriptOnly = useVideoDetailStore((s) => s.showMarkedTranscriptOnly);
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);
  const audio = videoJob?.audio_result;
  const canEnrichQa = videoJob?.audio_status === "done" && (audio?.transcript?.length ?? 0) > 0;
  const jobId = videoJob?.id ?? null;

  return (
    <>
      <div className="h-screen grid bg-background grid-cols-1 lg:grid-cols-[56px_1fr_420px] 2xl:grid-cols-[64px_1fr_480px]">
        {/* 左工具条 — 小屏隐藏，lg+ 显示。用 display:contents 让子组件继承 grid cell */}
        <div className="hidden lg:contents">
          <LeftToolbar noteId={note.id} isStarred={note.is_starred ?? false} />
        </div>

        {/* 主区域：顶栏 + 内容 — 任何屏幕都显示，移动端底部留出 56px 给 MobileTabBar */}
        <div className="flex flex-col overflow-hidden pb-14 lg:pb-0">
          {/* TopBar */}
          <header className="shrink-0 border-b border-border/50 bg-background/70 backdrop-blur-xl px-4 lg:px-6 h-14 flex items-center justify-between gap-2 relative z-30">
            <div className="min-w-0 flex-1">
              <TitleEditor noteId={note.id} initialTitle={note.title ?? ""} />
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
              <button
                onClick={() => setAudioMode(!audioMode)}
                className={
                  audioMode
                    ? "w-8 h-8 rounded bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center"
                    : "w-8 h-8 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center"
                }
                title={audioMode ? "展开视频" : "折叠为音频"}
              >
                {audioMode ? <VideoIcon size={15} /> : <AudioLines size={15} />}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("transcript");
                    if (window.innerWidth < 1024) setMobileSheetOpen("transcript");
                    setFilterOpen((v) => !v);
                  }}
                  className={
                    showMarkedTranscriptOnly
                      ? "w-8 h-8 rounded bg-blue-50/90 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center justify-center"
                      : "w-8 h-8 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center"
                  }
                  title="筛选标记"
                  aria-label="筛选标记"
                  aria-expanded={filterOpen}
                  aria-pressed={showMarkedTranscriptOnly}
                >
                  <Filter size={15} />
                </button>
                {filterOpen && (
                  <TranscriptMarkerFilterPopover className="absolute right-0 top-10 z-50" />
                )}
              </div>
              <ExcerptButton noteId={note.id} audio={videoJob?.audio_result ?? null} />
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
        <BriefPanel noteId={note.id} videoJob={videoJob} />
      </MobileSheet>
      <MobileSheet
        open={mobileSheetOpen === "transcript"}
        onClose={() => setMobileSheetOpen(null)}
        title="原文"
      >
        <TranscriptPanel noteId={note.id} videoJob={videoJob} />
      </MobileSheet>
      <MobileSheet
        open={mobileSheetOpen === "qa"}
        onClose={() => setMobileSheetOpen(null)}
        title="问答回顾"
      >
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <QATab
            qaPairs={audio?.qaPairs}
            jobId={jobId}
            canEnrich={canEnrichQa}
            noteId={note.id}
          />
        </div>
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
