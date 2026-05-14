"use client";

import { AnnotationList } from "./AnnotationList";
import { AIAnalysisPanel } from "./AIAnalysisPanel";
import { TranscriptView } from "./TranscriptView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Note } from "@/components/reader/ReaderPageWrapper";

// Keep original tab type for compatibility with ReaderLayout
type LegacyTab = "annotations" | "ai-analysis" | "transcript";

// Internal Radix Tabs values
type TabValue = "transcript" | "qa" | "visual" | "annotations" | "ai";

interface RightSidebarProps {
  note: Note;
  activeTab: LegacyTab;
  onTabChange: (tab: LegacyTab) => void;
  onCollapse: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RightSidebar({ note, activeTab, onTabChange, onCollapse, isCompact = false, onToggleCompact }: RightSidebarProps) {
  const isVideo = note.content_type === "video";

  // Map internal Radix tab value back to legacy tab type for parent state sync
  const handleTabChange = (value: string) => {
    const v = value as TabValue;
    if (v === "transcript") onTabChange("transcript");
    else onTabChange("annotations");
  };

  // Determine initial Radix tab value from legacy activeTab
  const radixValue: TabValue = activeTab === "transcript" && isVideo
    ? "transcript"
    : "annotations";

  if (isCompact) {
    // 紧凑模式只展示批注
    return (
      <div className="h-full flex flex-col bg-card dark:bg-slate-900 border-l border-border dark:border-slate-800">
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <AnnotationList noteId={note.id} isCompact={true} onExpand={onToggleCompact} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card dark:bg-slate-900 border-l border-border dark:border-slate-800">
      <Tabs
        value={radixValue}
        onValueChange={handleTabChange}
        className="flex flex-col h-full"
      >
        <TabsList className={`grid w-full shrink-0 ${isVideo ? "grid-cols-4" : "grid-cols-2"} rounded-none border-b border-border`}>
          {isVideo && (
            <TabsTrigger value="transcript" className="text-xs">转写</TabsTrigger>
          )}
          {isVideo && (
            <TabsTrigger value="qa" className="text-xs">Q&amp;A</TabsTrigger>
          )}
          {isVideo && (
            <TabsTrigger value="visual" className="text-xs">画面</TabsTrigger>
          )}
          <TabsTrigger value="annotations" className="text-xs">批注</TabsTrigger>
          {!isVideo && (
            <TabsTrigger value="ai" className="text-xs">AI 解读</TabsTrigger>
          )}
        </TabsList>

        {isVideo && (
          <TabsContent value="transcript" className="flex-1 overflow-y-auto scrollbar-hide mt-0">
            <TranscriptView note={note} />
          </TabsContent>
        )}
        {isVideo && (
          <TabsContent value="qa" className="flex-1 overflow-y-auto scrollbar-hide mt-0">
            <div className="p-4 text-sm text-muted-foreground">
              Q&amp;A panel — Task 23 placeholder
            </div>
          </TabsContent>
        )}
        {isVideo && (
          <TabsContent value="visual" className="flex-1 overflow-y-auto scrollbar-hide mt-0">
            <div className="p-4 text-sm text-muted-foreground">
              Visual frames — Task 24 placeholder
            </div>
          </TabsContent>
        )}
        <TabsContent value="annotations" className="flex-1 overflow-y-auto scrollbar-hide mt-0">
          <AnnotationList noteId={note.id} isCompact={false} onExpand={onToggleCompact} />
        </TabsContent>
        {!isVideo && (
          <TabsContent value="ai" className="flex-1 overflow-y-auto scrollbar-hide mt-0">
            <AIAnalysisPanel noteId={note.id} contentType={note.content_type} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
