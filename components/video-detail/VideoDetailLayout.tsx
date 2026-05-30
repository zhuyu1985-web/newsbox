"use client";

import { MainStage } from "./MainStage";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

export function VideoDetailLayout({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  return (
    <div
      className="h-screen grid bg-slate-50 dark:bg-slate-950"
      style={{ gridTemplateColumns: "64px 1fr 480px" }}
    >
      <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* LeftToolbar — Phase 9 */}
      </aside>

      <MainStage note={note} videoJob={videoJob} />

      <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* RightPanel — Phase 4-7 */}
      </aside>
    </div>
  );
}
