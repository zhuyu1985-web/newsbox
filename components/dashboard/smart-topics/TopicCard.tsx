import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MoreHorizontal, 
  Clock, 
  FileText, 
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  Star,
  Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicRow } from "@/app/api/knowledge/topics/rebuild/route";

interface TopicCardProps {
  topic: TopicRow & { category?: string; stats?: any; pinned?: boolean | null };
  onViewTimeline: (id: string) => void;
  onViewReport: (id: string) => void;
  onMore: (id: string, e: React.MouseEvent) => void;
  isNew?: boolean;
}

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  onViewTimeline,
  onViewReport,
  onMore,
  isNew
}) => {
  const keywords = topic.keywords || [];
  const memberCount = topic.member_count || 0;
  
  // Generate a display ID like T-2024-001 based on creation date and a slice of ID
  const displayId = `T-${new Date(topic.created_at).getFullYear()}-${topic.id.slice(0, 3).toUpperCase()}`;

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours || 1} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  return (
    <Card
      key={topic.id}
      className="group relative bg-white border border-slate-200/90 shadow-none hover:shadow-[0_20px_60px_rgba(15,23,42,0.06)] hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-row rounded-[20px] cursor-pointer min-h-[140px]"
      onClick={() => onViewTimeline(topic.id)}
    >
      {/* Left Content Area */}
      <div className="flex-1 p-5 flex flex-col">
        {/* Row 1: Badges & ID */}
        <div className="flex items-center gap-3 mb-2">
          <Badge className="bg-blue-50 text-blue-600 border-none rounded-lg text-[10px] font-bold py-0.5 px-2">
            已合并
          </Badge>
          <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
            ID: {displayId}
          </span>
        </div>

        {/* Row 2: Title */}
        <h3 className="text-[15px] font-black text-slate-900 leading-tight mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {topic.title || "未命名专题"}
        </h3>

        {/* Row 3: Keywords/Tags (Hidden or simplified to save space) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {keywords.slice(0, 2).map((k) => (
            <div key={k} className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100/50">
              <span className="text-[10px] text-slate-400 font-bold">#</span>
              <span className="text-[10px] font-bold text-slate-500">{k}</span>
            </div>
          ))}
        </div>

        {/* Row 4: Stats & Status (Bottom) */}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-bold text-slate-600">{memberCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-bold text-slate-600">{formatRelativeTime(topic.created_at)}</span>
            </div>
          </div>

          <div>
            {topic.summary_markdown ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/50">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase">报告已生成</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100/50">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span className="text-[10px] font-bold uppercase">分析中</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Accent Area (Inspired by reference image, but no photo) */}
      <div className={cn(
        "w-32 flex flex-col items-center justify-center p-4 border-l border-slate-50",
        topic.summary_markdown ? "bg-emerald-50/30" : "bg-blue-50/30"
      )}>
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-sm",
          topic.summary_markdown ? "bg-white text-emerald-500" : "bg-white text-blue-500"
        )}>
          {topic.summary_markdown ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </div>
        <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter leading-tight">
          {topic.summary_markdown ? "内容分析已完成" : "智能聚类中..."}
        </p>
      </div>

      {/* Hover Actions */}
      <div className="absolute top-4 right-4 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl bg-white shadow-lg border border-slate-100 text-slate-400 hover:text-blue-600"
          onClick={(e) => {
            e.stopPropagation();
            onMore(topic.id, e);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
