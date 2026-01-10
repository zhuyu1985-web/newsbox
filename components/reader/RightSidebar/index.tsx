"use client";

import { AnnotationList } from "./AnnotationList";
import { AIAnalysisPanel } from "./AIAnalysisPanel";
import { TranscriptView } from "./TranscriptView";
import { Button } from "@/components/ui/button";
import { PanelLeftOpen, PanelRightClose, X, ChevronsRight, MessageSquare, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  content_type: "article" | "video" | "audio";
}

interface RightSidebarProps {
  note: Note;
  activeTab: "annotations" | "ai-analysis" | "transcript";
  onTabChange: (tab: "annotations" | "ai-analysis" | "transcript") => void;
  onCollapse: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

export function RightSidebar({
  note,
  activeTab,
  onTabChange,
  onCollapse,
  isCompact = false,
  onToggleCompact,
}: RightSidebarProps) {

  const renderHeader = () => {
    // 只有在批注 Tab 且支持 compact 模式时显示切换按钮
    const showCompactToggle = activeTab === "annotations" && onToggleCompact;

    if (isCompact) {
      return (
        <div className="flex flex-col items-center py-4 gap-4 border-b border-slate-50">
          <div className="w-8 h-px bg-slate-100" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800">
      {renderHeader()}
      
      {/* Tab内容区 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === "annotations" && <AnnotationList noteId={note.id} isCompact={isCompact} onExpand={onToggleCompact} />}
        {activeTab === "ai-analysis" && !isCompact && <AIAnalysisPanel noteId={note.id} contentType={note.content_type} />}
        {activeTab === "transcript" && note.content_type === "video" && !isCompact && (
          <TranscriptView noteId={note.id} />
        )}
      </div>
    </div>
  );
}
