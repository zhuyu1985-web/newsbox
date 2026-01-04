import React from "react";
import { 
  ChevronLeft, 
  Share2, 
  Download, 
  Sparkles, 
  Clock, 
  FileText,
  Search,
  Bell,
  MoreVertical,
  Volume2,
  Maximize2,
  Copy,
  ExternalLink,
  ChevronRight,
  Zap,
  Network
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopicDetail } from "./types";
import { cn } from "@/lib/utils";

interface TopicReportViewProps {
  detail: TopicDetail;
  onBack: () => void;
  onShare: () => void;
  onDownload: () => void;
  onOpenNote: (id: string) => void;
  hideHeader?: boolean;
}

export const TopicReportView: React.FC<TopicReportViewProps> = ({
  detail,
  onBack,
  onShare,
  onDownload,
  onOpenNote,
  hideHeader
}) => {
  const { topic, members } = detail;
  const keywords = topic.keywords || [];

  return (
    <div className="flex-1 flex flex-col bg-white text-slate-900 overflow-hidden">
      {/* Top Navigation / Breadcrumbs Bar */}
      {!hideHeader && (
        <div className="px-8 h-16 flex items-center justify-between border-b border-slate-200/80">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>仪表盘</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={onBack}>智能专题</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-slate-900 truncate max-w-[200px]">报告预览</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索专题..." 
                className="bg-slate-100/50 border-none rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400 w-48 focus:w-64 transition-all"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100">
              <Bell className="h-4.5 w-4.5" />
            </Button>
            <div className="h-8 w-8 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="User" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
        <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
          {/* Page Header Area */}
          {!hideHeader && (
            <div className="flex items-start justify-between">
              <div className="space-y-6 flex-1 max-w-4xl">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-50 text-blue-600 border-blue-100 rounded-lg px-3 py-1 font-bold text-[10px] gap-1.5">
                    <Zap className="h-3 w-3 fill-current" /> AI 自动生成
                  </Badge>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 rounded-lg px-3 py-1 font-bold text-[10px] gap-1.5">
                    置信度：高
                  </Badge>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">更新于 2小时前</span>
                </div>

                <h1 className="text-5xl font-extrabold text-slate-900 leading-[1.15] tracking-tight">
                  {topic.title || "未命名专题报告"}
                </h1>

                <p className="text-lg text-slate-500 leading-relaxed font-medium">
                  基于最近关于{keywords.slice(0, 2).join("、")}和{keywords[2] || "相关领域"}等政策的{members.length}篇入库文章，自动生成的智能简报。
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" className="bg-white border-slate-200 rounded-xl gap-2 h-11 px-5 font-bold shadow-sm" onClick={onShare}>
                  <Share2 className="h-4 w-4" /> 分享
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl gap-2 h-11 px-6 shadow-lg shadow-blue-600/20 font-bold border-none" onClick={onDownload}>
                  <Download className="h-4 w-4" /> 下载报告
                </Button>
              </div>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 pt-4">
            {/* Left: Report Content */}
            <div className="space-y-10">
              <div className="bg-white border border-slate-200/90 rounded-[32px] shadow-sm overflow-hidden">
                {/* Content Controls */}
                <div className="px-8 h-14 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">预览模式 (MARKDOWN)</span>
                  <div className="flex items-center gap-4 text-slate-400">
                    <button className="flex items-center gap-1.5 text-[11px] font-bold hover:text-blue-600 transition-colors">
                      <Copy className="h-3.5 w-3.5" /> 复制 Markdown
                    </button>
                    <Volume2 className="h-4 w-4 cursor-pointer hover:text-slate-600 transition-colors" />
                    <Maximize2 className="h-4 w-4 cursor-pointer hover:text-slate-600 transition-colors" />
                  </div>
                </div>

                {/* Markdown Body */}
                <div className="p-10 prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-blue-600 prose-ul:list-disc prose-li:text-slate-600">
                  {!topic.summary_markdown?.trim() ? (
                    <div className="space-y-12">
                      <section>
                        <h2 className="text-slate-900 border-b-0 mb-6">一、事件背景</h2>
                        <p>
                          全球电动汽车（EV）电池 market 正处于由原材料稀缺和地缘政治联盟转变推动的重大变革之中。近期数据显示，<strong>锂价格在上个季度上涨了15%</strong>，促使欧盟和北美的主要制造商重新审视其供应链策略。本报告综合了14个关键信息源，概述了2023年第四季度的新兴趋势及潜在风险。
                        </p>
                      </section>
                      <section>
                        <h2 className="text-slate-900 mb-6">二、核心观点</h2>
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-2xl space-y-3 shadow-sm">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                            <Sparkles className="h-4 w-4 fill-current" /> 关键洞察
                          </div>
                          <p className="italic text-slate-700 font-medium leading-relaxed">
                            “未能在这个财年结束前确保长期锂组合的制造商，可能会在下一财年面临高达20%的生产瓶颈。”
                          </p>
                        </div>
                        <ul className="mt-10 space-y-6 list-none pl-0">
                          <li className="flex items-start gap-4">
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                            <div>
                              <div className="font-bold text-slate-900 mb-1">生产本地化加速</div>
                              <p className="text-sm">欧盟新规要求到2030年，40%的加工必须在成员国内进行，这正在重塑工厂选址逻辑。</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-4">
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-2.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                            <div>
                              <div className="font-bold text-slate-900 mb-1">替代化学技术崛起</div>
                              <p className="text-sm">钠离子电池作为低续航车辆的低成本替代方案，正获得更多资本青睐。</p>
                            </div>
                          </li>
                        </ul>
                      </section>
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: topic.summary_markdown }} />
                  )}
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-3xl">
                免责声明：本报告由智能专题AI引擎生成。尽管置信度较高，但请务必参考右栏侧边栏链接的原始资料以核实关键数据点。
              </p>
            </div>

            {/* Right: Side Info */}
            <div className="space-y-8">
              {/* Source Articles */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">来源文章</h3>
                  <span className="text-[10px] font-bold text-slate-300 uppercase">发现 {members.length} 篇</span>
                </div>
                <div className="space-y-3">
                  {members.slice(0, 4).map((m) => (
                    <div key={m.noteId} className="flex gap-4 p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm transition-all group cursor-pointer" onClick={() => onOpenNote(m.noteId)}>
                      <div className="h-16 w-16 rounded-xl bg-slate-100 shrink-0 overflow-hidden border border-slate-200">
                        {m.note.cover_image_url ? (
                          <img src={m.note.cover_image_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-300 font-bold uppercase">{m.note.site_name?.charAt(0)}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <h4 className="text-[13px] font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{m.note.title}</h4>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                          <span className="truncate">{m.note.site_name}</span>
                          <span>•</span>
                          <span>4小时前</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-6 rounded-2xl border border-dashed border-blue-100">
                  查看全部 {members.length} 个来源
                </Button>
              </div>

              {/* Topic Preview Graph */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">专题摘要预览</h3>
                  <Maximize2 className="h-3.5 w-3.5 text-slate-300 cursor-pointer hover:text-blue-500 transition-colors" />
                </div>
                <div className="aspect-[4/3] rounded-[32px] bg-white border border-slate-200/80 shadow-sm overflow-hidden relative group p-6 flex flex-col justify-end">
                  {/* Graph Mockup Background */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Network className="h-32 w-32 text-blue-500/5" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_white_100%)] opacity-80" />
                  </div>
                  
                  <div className="relative z-10 space-y-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">簇密度：高 / 拓扑结构稳定</div>
                    <div className="flex flex-wrap gap-2">
                      {keywords.slice(0, 5).map(k => (
                        <span key={k} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-sm">#{k}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
