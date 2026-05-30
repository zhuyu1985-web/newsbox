"use client";

import { MainStage } from "./MainStage";
import { MiniPlayer } from "./MiniPlayer";
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
        className="h-screen grid bg-slate-50 dark:bg-slate-950"
        style={{ gridTemplateColumns: "64px 1fr 480px" }}
      >
        <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center gap-1 py-3 text-[10px] text-slate-400">
          {/* LeftToolbar — Phase 9 占位 */}
          <span>左工具条</span>
          <span>Phase 9</span>
        </aside>

        <MainStage note={note} videoJob={videoJob} />

        <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-sm text-slate-400">
          {/* RightPanel — Phase 4-7 占位 */}
          右栏 · Phase 4-7（速览 / 原文 / 笔记）
        </aside>
      </div>
      <MiniPlayer title={note.title ?? ""} duration={note.media_duration ?? 0} />
    </>
  );
}
