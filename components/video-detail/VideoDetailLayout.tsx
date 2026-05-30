"use client";

import type { Note, VideoJobRow } from '@/components/reader/ReaderPageWrapper';

export function VideoDetailLayout({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  return (
    <div className="h-screen grid bg-slate-50 dark:bg-slate-950" style={{ gridTemplateColumns: '64px 1fr 480px' }}>
      <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* LeftToolbar — Phase 9 */}
      </aside>

      <main className="overflow-y-auto relative">
        {/* TopBar — Phase 8 */}
        <div className="p-6 space-y-6">
          {/* MainStage — Phase 3 */}
          <div className="rounded-xl bg-slate-200 dark:bg-slate-800" style={{ aspectRatio: '16/9' }}>
            视频播放器占位 · {note.title}
          </div>
        </div>
      </main>

      <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* RightPanel — Phase 4-7 */}
      </aside>
    </div>
  );
}
