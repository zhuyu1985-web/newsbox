import React from "react";
import { 
  ChevronLeft, 
  Share2, 
  FileDown, 
  Sparkles, 
  MapPin, 
  Hash, 
  Network,
  Video,
  FileText,
  Clock,
  ExternalLink,
  ChevronDown,
  ListFilter,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopicDetail } from "./types";
import { cn } from "@/lib/utils";

interface TopicTimelineViewProps {
  detail: TopicDetail;
  onBack: () => void;
  onShare: () => void;
  onExport: () => void;
  onGenerateReport: () => void;
  onOpenNote: (id: string) => void;
  hideHeader?: boolean;
}

export const TopicTimelineView: React.FC<TopicTimelineViewProps> = ({
  detail,
  onBack,
  onShare,
  onExport,
  onGenerateReport,
  onOpenNote,
  hideHeader
}) => {
  const { topic, events } = detail;
  const keywords = topic.keywords || [];

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-900 overflow-hidden">
      {/* Header */}
      {!hideHeader && (
        <div className="px-8 pt-6 pb-6 border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                className="text-slate-500 hover:text-slate-900 p-0 gap-1.5"
                onClick={onBack}
              >
                <ChevronLeft className="h-4 w-4" />
                返回列表
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-slate-600">专题详情</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="bg-slate-50 border-slate-200 rounded-xl gap-2 text-slate-600" onClick={onShare}>
                  <Share2 className="h-4 w-4" /> 分享
                </Button>
                <Button variant="outline" className="bg-slate-50 border-slate-200 rounded-xl gap-2 text-slate-600" onClick={onExport}>
                  <FileDown className="h-4 w-4" /> 导出 MD
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl gap-2 px-4" onClick={onGenerateReport}>
                  <Sparkles className="h-4 w-4" /> 生成 AI 报告
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                {topic.title || "未命名专题"}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-50 text-blue-600 border-blue-100 rounded-lg gap-1.5 font-medium py-1">
                  <Clock className="h-3 w-3" />
                  生成于 {new Date(topic.created_at).toLocaleDateString()}
                </Badge>
                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 rounded-lg gap-1.5 font-medium py-1">
                  <FileText className="h-3 w-3" />
                  包含 {topic.member_count} 篇内容
                </Badge>
                <Badge className="bg-purple-50 text-purple-600 border-purple-100 rounded-lg gap-1.5 font-medium py-1">
                  <Sparkles className="h-3 w-3" />
                  AI 置信度: 94%
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline Column */}
        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar bg-slate-50/30">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <Network className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-bold text-slate-900">事件时间轴</h2>
              </div>
              <Button variant="ghost" className="text-[11px] font-bold tracking-wider text-slate-500 hover:text-slate-800 gap-2 uppercase">
                按事件时间排序
                <ChevronDown className="h-3.5 w-3.5" />
                <ListFilter className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="relative pl-8 border-l border-slate-200 space-y-12">
              {events.map((ev, idx) => {
                const evidence = ev.evidence || [];
                const primary = evidence[0];
                if (!primary) return null;

                return (
                  <div key={ev.id} className="relative">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[41px] top-1.5 h-[18px] w-[18px] rounded-full bg-blue-600 ring-4 ring-white flex items-center justify-center shadow-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>

                    <div className="space-y-4">
                      {/* Meta */}
                      <div className="flex items-center gap-3 text-xs">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-2 py-0.5 rounded-md">
                          {new Date(ev.event_time).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </Badge>
                        <span className="text-slate-500 font-medium">来源: {primary.note.site_name || "未知"}</span>
                      </div>

                      {/* Content Card (Matched to renderNoteCard style) */}
                      <div 
                        className="group bg-white border border-slate-200/90 hover:border-blue-500/30 hover:shadow-[0_18px_50px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 rounded-[20px] p-6 cursor-pointer"
                        onClick={() => onOpenNote(primary.note.id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 border-none rounded">
                            {primary.note.content_type === "video" ? <Video className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                            {primary.note.content_type || "文本"}
                          </Badge>
                          {evidence.length > 1 && (
                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] px-1.5 py-0 rounded">
                              核心节点
                            </Badge>
                          )}
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2 leading-tight">
                          {ev.title || primary.note.title}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">
                          {primary.note.excerpt || primary.note.content_text}
                        </p>

                        <div className="mt-6 flex items-center justify-between">
                          <div className="flex items-center -space-x-2">
                            {evidence.slice(0, 3).map((m, i) => (
                              <div key={i} className="h-7 w-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 overflow-hidden shadow-sm">
                                {m.note.cover_image_url ? (
                                  <img src={m.note.cover_image_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  m.note.site_name?.charAt(0) || "N"
                                )}
                              </div>
                            ))}
                            {evidence.length > 3 && (
                              <div className="h-7 w-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 z-10 shadow-sm">
                                +{evidence.length - 3}
                              </div>
                            )}
                            <span className="ml-4 text-[11px] font-bold text-slate-400">+{evidence.length} 篇关联内容</span>
                          </div>
                          
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 px-2 h-8 rounded-lg font-bold text-[11px]">
                            查看全文 <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* End line */}
              <div className="pt-4 text-center">
                <p className="text-xs text-slate-400 italic">已显示全部事件节点。等待新内容更新...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="w-[340px] border-l border-slate-200/80 bg-white overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar">
          {/* Analysis Summary Card (Replacing the map) */}
          <div className="space-y-4">
            <div className="p-5 rounded-[24px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden shadow-lg shadow-blue-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -mr-8 -mt-8 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">智能专题分析</span>
                </div>
                <h4 className="text-xl font-black mb-2 leading-tight">核心脉络已就绪</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  通过对 {topic.member_count} 篇内容进行语义关联分析，AI 已为您梳理出关键事件节点与实体关联。
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <Badge className="bg-white/20 border-none text-white text-[10px] py-0.5">
                    深度 94%
                  </Badge>
                  <Badge className="bg-white/20 border-none text-white text-[10px] py-0.5">
                    多源交叉
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Top Entities */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wider">
              <Network className="h-4 w-4 text-blue-500" />
              核心实体
            </div>
            <div className="space-y-2">
              {[
                { name: "英伟达", count: 12, code: "NV" },
                { name: "台积电", count: 8, code: "TS" },
                { name: "美国政府", count: 5, code: "US" },
              ].map((ent) => (
                <div key={ent.name} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-200/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white shadow-sm border border-slate-200/60 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                      {ent.code}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{ent.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200/60 px-2 py-0.5 rounded-md">{ent.count} 次提及</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Keywords */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wider">
              <Hash className="h-4 w-4 text-blue-500" />
              热词趋势
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {keywords.map((k) => (
                <Badge key={k} variant="outline" className="bg-white border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors py-1 px-3 rounded-full font-bold text-[10px] shadow-sm">
                  {k}
                </Badge>
              ))}
            </div>
          </div>

          {/* Related Topics */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-blue-500" />
              相关专题
            </div>
            <div className="space-y-4 pt-2">
              {[
                { title: "电动汽车电池材料短缺", date: "10月22日", count: 8 },
                { title: "云计算基础设施建设", date: "10月19日", count: 12 },
              ].map((rt) => (
                <div key={rt.title} className="group cursor-pointer">
                  <h5 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-1">{rt.title}</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">生成于 {rt.date} • {rt.count} 篇内容</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
