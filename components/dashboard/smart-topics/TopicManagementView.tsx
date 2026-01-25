import React, { useState, useEffect, useCallback } from "react";
import { SmartTopicsDashboard } from "./SmartTopicsDashboard";
import { TopicTimelineView } from "./TopicTimelineView";
import { TopicReportView } from "./TopicReportView";
import { TopicSubView, TopicDetail } from "./types";
import type { TopicRow } from "@/app/api/knowledge/topics/rebuild/route";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  Share2, 
  FileDown, 
  Sparkles, 
  LineChart,
  Download,
  MoreHorizontal,
  ChevronRight,
  Clock,
  FileText,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TopicManagementViewProps {
  userId: string;
  topics: TopicRow[];
  loadingTopics: boolean;
  rebuildingTopics: boolean;
  onRebuild: () => void;
  onTopicAction: (topic: any, action: "pin" | "archive" | "delete") => void;
}

export const TopicManagementView: React.FC<TopicManagementViewProps> = ({
  userId,
  topics,
  loadingTopics,
  rebuildingTopics,
  onRebuild,
  onTopicAction
}) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [subView, setSubView] = useState<TopicSubView>("list");
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadTopicDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const resp = await fetch(`/api/knowledge/topics/${id}`);
      if (!resp.ok) throw new Error("Failed to load topic detail");
      const data = await resp.json();
      setTopicDetail(data);
    } catch (err) {
      console.error(err);
      toast.error("加载专题详情失败");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (activeTopicId) {
      loadTopicDetail(activeTopicId);
    } else {
      setTopicDetail(null);
    }
  }, [activeTopicId, loadTopicDetail]);

  const handleViewTimeline = (id: string) => {
    setActiveTopicId(id);
    setSubView("timeline");
  };

  const handleViewReport = (id: string) => {
    setActiveTopicId(id);
    setSubView("report");
  };

  const handleBackToList = () => {
    setActiveTopicId(null);
    setSubView("list");
  };

  const handleOpenNote = (noteId: string) => {
    window.open(`/notes/${noteId}`, "_blank");
  };

  if (subView === "list" || !activeTopicId) {
    return (
      <SmartTopicsDashboard 
        topics={topics}
        loading={loadingTopics}
        rebuilding={rebuildingTopics}
        onRebuild={onRebuild}
        onViewTimeline={handleViewTimeline}
        onViewReport={handleViewReport}
        onTopicMore={(id, e) => {
          // You could open a context menu here if needed
        }}
      />
    );
  }

  if (loadingDetail || !topicDetail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-card">
        <div className="h-8 w-8 text-blue-500 animate-spin border-4 border-current border-t-transparent rounded-full" />
        <p className="text-muted-foreground mt-4 font-medium">加载专题内容中...</p>
      </div>
    );
  }

  const { topic } = topicDetail;

  return (
    <div className="flex-1 flex flex-col bg-card text-card-foreground overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Shared Detail Header (Moved inside scroll to not be fixed) */}
        <div className="px-8 pt-6 pb-0 border-b border-border/80">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Breadcrumbs & Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm font-bold tracking-wider text-muted-foreground uppercase">
                <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={handleBackToList}>智能专题</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-card-foreground">专题详情</span>
              </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="bg-muted border-border rounded-xl gap-2 text-card-foreground h-9" onClick={() => toast.info("功能开发中")}>
                <Share2 className="h-3.5 w-3.5" /> 分享
              </Button>
              {subView === "timeline" ? (
                <Button variant="outline" className="bg-muted border-border rounded-xl gap-2 text-card-foreground h-9" onClick={() => toast.info("功能开发中")}>
                  <FileDown className="h-3.5 w-3.5" /> 导出 MD
                </Button>
              ) : (
                <Button variant="outline" className="bg-muted border-border rounded-xl gap-2 text-card-foreground h-9" onClick={() => toast.info("功能开发中")}>
                  <Download className="h-3.5 w-3.5" /> 下载报告
                </Button>
              )}
              {subView === "timeline" && !topic.summary_markdown && (
                <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl gap-2 px-4 h-9 shadow-lg shadow-blue-600/20" onClick={() => setSubView("report")}>
                  <Sparkles className="h-3.5 w-3.5" /> 生成 AI 报告
                </Button>
              )}
            </div>
          </div>

          {/* Title and Meta */}
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-extrabold text-card-foreground tracking-tight">
              {topic.title || "未命名专题"}
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              基于该专题下的 {topic.member_count} 篇内容，通过 AI 智能分析生成的深度脉络与专题报告。
            </p>
            
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-blue-50 text-blue-600 border-blue-100 rounded-lg gap-1.5 font-bold py-1 px-3 text-[10px]">
                <Clock className="h-3 w-3" />
                生成于 {new Date(topic.created_at).toLocaleDateString()}
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 rounded-lg gap-1.5 font-bold py-1 px-3 text-[10px]">
                <FileText className="h-3 w-3" />
                包含 {topic.member_count} 篇内容
              </Badge>
              {topic.summary_markdown && (
                <Badge className="bg-purple-50 text-purple-600 border-purple-100 rounded-lg gap-1.5 font-bold py-1 px-3 text-[10px]">
                  <Sparkles className="h-3 w-3" />
                  AI 报告已就绪
                </Badge>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-8 mt-4">
            <button
              onClick={() => setSubView("timeline")}
              className={cn(
                "pb-4 text-sm font-bold tracking-wide transition-all relative flex items-center gap-2",
                subView === "timeline" ? "text-blue-600" : "text-muted-foreground/70 hover:text-card-foreground"
              )}
            >
              <LineChart className="h-4 w-4" />
              智能时间轴（事件节点）
              {subView === "timeline" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setSubView("report")}
              className={cn(
                "pb-4 text-sm font-bold tracking-wide transition-all relative flex items-center gap-2",
                subView === "report" ? "text-blue-600" : "text-muted-foreground/70 hover:text-card-foreground"
              )}
            >
              <FileText className="h-4 w-4" />
              专题报告
              {subView === "report" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

        {/* View Content */}
        <div className="flex-1 flex flex-col">
          {subView === "timeline" ? (
            <TopicTimelineView 
              detail={topicDetail}
              onBack={handleBackToList}
              onShare={() => toast.info("分享功能开发中")}
              onExport={() => toast.info("导出功能开发中")}
              onGenerateReport={() => setSubView("report")}
              onOpenNote={handleOpenNote}
              hideHeader={true}
            />
          ) : (
            <TopicReportView 
              detail={topicDetail}
              onBack={handleBackToList}
              onShare={() => toast.info("分享功能开发中")}
              onDownload={() => toast.info("下载功能开发中")}
              onOpenNote={handleOpenNote}
              hideHeader={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
