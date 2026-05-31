"use client";
import { useVideoDetailStore } from "../store";
import { Sparkles, FileText, NotebookPen } from "lucide-react";
import { BriefPanel } from "./BriefPanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { NotesPanel } from "./NotesPanel";
import type { Note, VideoJobRow } from "@/components/reader/ReaderPageWrapper";

const TABS = [
  { key: "brief", label: "速览", Icon: Sparkles },
  { key: "transcript", label: "原文", Icon: FileText },
  { key: "notes", label: "笔记", Icon: NotebookPen },
] as const;

export function RightPanel({
  note,
  videoJob,
}: {
  note: Note;
  videoJob: VideoJobRow | null;
}) {
  const activeTab = useVideoDetailStore((s) => s.activeTab);
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);

  return (
    <aside className="border-l border-border/50 bg-card/40 backdrop-blur-xl flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="border-b border-border/50 px-3 flex items-center gap-0.5 shrink-0 h-14">
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={
                active
                  ? "px-3 h-10 text-sm font-medium border-b-2 border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-400 flex items-center gap-1.5 -mb-px"
                  : "px-3 h-10 text-sm border-b-2 border-transparent text-muted-foreground hover:text-foreground flex items-center gap-1.5 -mb-px"
              }
            >
              <t.Icon size={14} />
              {t.label}
            </button>
          );
        })}
        <div className="ml-auto text-[11px] text-muted-foreground pr-1">
          由 通义听悟 生成
        </div>
      </div>

      {/* Tab Panels — all mounted, controlled by hidden (preserves state) */}
      <div className={activeTab === "brief" ? "flex-1 overflow-hidden flex flex-col" : "hidden"}>
        <BriefPanel videoJob={videoJob} />
      </div>
      <div className={activeTab === "transcript" ? "flex-1 overflow-hidden flex flex-col" : "hidden"}>
        <TranscriptPanel videoJob={videoJob} />
      </div>
      <div className={activeTab === "notes" ? "flex-1 overflow-hidden flex flex-col" : "hidden"}>
        <NotesPanel
          noteId={note.id}
          initialContent={note.user_notes}
        />
      </div>
    </aside>
  );
}
