import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  RefreshCw, 
  Sparkles, 
  Search, 
  Calendar, 
  ArrowUpDown,
  Loader2,
  Clock,
  FileText,
  TrendingUp,
  ChevronDown,
  Filter,
  SortAsc,
  SortDesc,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopicCard } from "./TopicCard";
import type { TopicRow } from "@/app/api/knowledge/topics/rebuild/route";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SmartTopicsDashboardProps {
  topics: TopicRow[];
  loading: boolean;
  rebuilding: boolean;
  onRebuild: () => void;
  onViewTimeline: (id: string) => void;
  onViewReport: (id: string) => void;
  onTopicMore: (id: string, e: React.MouseEvent) => void;
}

const ITEMS_PER_PAGE = 12;

export const SmartTopicsDashboard: React.FC<SmartTopicsDashboardProps> = ({
  topics,
  loading,
  rebuilding,
  onRebuild,
  onViewTimeline,
  onViewReport,
  onTopicMore
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // all, 24h, 3d, 7d, 1m
  const [sortOrder, setSortOrder] = useState("newest"); // newest, oldest, name_asc, name_desc
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Stats calculation
  const stats = useMemo(() => {
    const totalTopics = topics.length;
    const totalArticles = topics.reduce((acc, t) => acc + (t.member_count || 0), 0);
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const todayTopics = topics.filter(t => new Date(t.created_at).getTime() >= todayStart);
    const todayArticles = todayTopics.reduce((acc, t) => acc + (t.member_count || 0), 0);

    return {
      totalTopics,
      totalArticles,
      todayTopics: todayTopics.length,
      todayArticles
    };
  }, [topics]);

  const filteredTopics = useMemo(() => {
    let result = [...topics];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        (t.title || "").toLowerCase().includes(q) || 
        (t.keywords || []).some(k => k.toLowerCase().includes(q))
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date().getTime();
      const day = 24 * 60 * 60 * 1000;
      let threshold = 0;
      if (dateFilter === "24h") threshold = now - day;
      else if (dateFilter === "3d") threshold = now - 3 * day;
      else if (dateFilter === "7d") threshold = now - 7 * day;
      else if (dateFilter === "1m") threshold = now - 30 * day;
      
      if (threshold > 0) {
        result = result.filter(t => new Date(t.created_at).getTime() >= threshold);
      }
    }

    // Sort
    result.sort((a, b) => {
      if (sortOrder === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === "name_asc") return (a.title || "").localeCompare(b.title || "");
      if (sortOrder === "name_desc") return (b.title || "").localeCompare(a.title || "");
      return 0;
    });

    return result;
  }, [topics, searchQuery, dateFilter, sortOrder]);

  const displayedTopics = useMemo(() => {
    return filteredTopics.slice(0, displayCount);
  }, [filteredTopics, displayCount]);

  // Infinite Scroll Handler
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      if (displayCount < filteredTopics.length) {
        setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredTopics.length));
      }
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [displayCount, filteredTopics.length]);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        {/* Row 1: Navigation & Main Actions (Moved inside scroll to not be fixed) */}
        <div className="px-8 py-5 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              智能专题
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Beta</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">基于 AI 语义聚类技术，为您自动梳理知识脉络与核心话题。</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl border-border text-card-foreground gap-2 h-9 px-4 hover:bg-muted"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> 刷新专题列表
            </Button>
            <Button 
              size="sm" 
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9 px-5 shadow-lg shadow-blue-200 transition-all active:scale-95"
              onClick={onRebuild}
              disabled={rebuilding}
            >
              {rebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              立即出发聚类
            </Button>
          </div>
        </div>

        <div className="px-8 py-6 max-w-7xl mx-auto space-y-8">
          
          {/* Row 2: Statistics Module */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "专题总数", value: stats.totalTopics, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "入库文章数", value: stats.totalArticles, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "今日生成专题", value: stats.todayTopics, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "今日入库文章", value: stats.todayArticles, icon: History, color: "text-indigo-600", bg: "bg-indigo-50" },
            ].map((stat, i) => (
              <div key={i} className="bg-card p-5 rounded-[20px] border border-border flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black text-card-foreground mt-0.5">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Row 3: Search & Filters */}
          <div className="flex flex-col md:flex-row items-center gap-4 bg-card p-4 rounded-[20px] border border-border shadow-sm">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input 
                placeholder="搜索专题名称、关键词或摘要..." 
                className="w-full bg-muted/50 border-border pl-10 h-10 rounded-xl focus-visible:ring-blue-500/20 transition-all text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[130px] h-8 border-none bg-transparent focus:ring-0 text-xs font-medium text-card-foreground">
                    <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground/70" />
                    <SelectValue placeholder="日期检索" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="all">全部时间</SelectItem>
                    <SelectItem value="24h">24小时内</SelectItem>
                    <SelectItem value="3d">3日内</SelectItem>
                    <SelectItem value="7d">7日内</SelectItem>
                    <SelectItem value="1m">1个月内</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="w-px h-4 bg-slate-200" />
                
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-[140px] h-8 border-none bg-transparent focus:ring-0 text-xs font-medium text-card-foreground">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground/70" />
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="newest">最新生成倒序</SelectItem>
                    <SelectItem value="oldest">时间生成正序</SelectItem>
                    <SelectItem value="name_asc">专题名称正序</SelectItem>
                    <SelectItem value="name_desc">专题名称倒序</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Row 4: Topic List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
                专题列表
                <span className="text-xs font-normal text-muted-foreground/70">({filteredTopics.length})</span>
              </h3>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-xs text-muted-foreground/70 font-medium tracking-wide">正在构建智能视图...</p>
              </div>
            ) : filteredTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-card border border-dashed border-border rounded-[32px]">
                <div className="h-20 w-20 rounded-[28px] bg-muted flex items-center justify-center mb-6">
                  <Sparkles className="h-8 w-8 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-card-foreground">未找到相关专题</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
                  尝试调整搜索词或筛选条件，或者点击顶部的 “立即出发聚类” 重新生成。
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {displayedTopics.map((t) => (
                  <TopicCard 
                    key={t.id} 
                    topic={t} 
                    onViewTimeline={onViewTimeline}
                    onViewReport={onViewReport}
                    onMore={onTopicMore}
                    isNew={false}
                  />
                ))}
              </div>
            )}

            {/* Infinite Scroll Loader */}
            {displayCount < filteredTopics.length && (
              <div className="flex justify-center py-10">
                <div className="flex items-center gap-3 px-6 py-2 bg-card rounded-full border border-border shadow-sm">
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground">正在加载更多专题...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
