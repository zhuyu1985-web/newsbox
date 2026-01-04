"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Home,
  Eye,
  Globe,
  Sparkles,
  Archive as ArchiveIcon,
  Settings,
  MoreHorizontal,
  MessageSquare,
  StickyNote,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ViewSwitcher } from "./ViewSwitcher";
import { AppearanceMenu } from "./AppearanceMenu";
import { ActionMenu } from "./ActionMenu";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string | null;
  content_type: "article" | "video" | "audio";
  source_url: string | null;
  is_starred?: boolean;
}

interface Folder {
  id: string;
  name: string;
}

interface GlobalHeaderProps {
  note: Note;
  folder: Folder | null;
  currentView: "reader" | "web" | "ai-brief" | "archive";
  onViewChange: (view: "reader" | "web" | "ai-brief" | "archive") => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  scrollProgress: number;
  onToggleRightSidebar: () => void;
  activeRightTab: "annotations" | "ai-analysis" | "transcript";
  onRightTabChange: (tab: "annotations" | "ai-analysis" | "transcript") => void;
  isRightSidebarCollapsed: boolean;
  isSidebarCompact: boolean;
  onToggleCompact: () => void;
}

export function GlobalHeader({
  note,
  folder,
  currentView,
  onViewChange,
  isZenMode,
  onToggleZenMode,
  scrollProgress,
  onToggleRightSidebar,
  activeRightTab,
  onRightTabChange,
  isRightSidebarCollapsed,
  isSidebarCompact,
  onToggleCompact,
}: GlobalHeaderProps) {
  const router = useRouter();
  const [annotationCount, setAnnotationCount] = useState(0); // TODO: 从API获取
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentNote, setCurrentNote] = useState(note);

  // 同步 note 数据更新
  useEffect(() => {
    setCurrentNote(note);
  }, [note]);

  // 处理笔记数据更新（如星标状态变化）
  const handleNoteChange = (updates: Partial<Note>) => {
    setCurrentNote((prev) => ({ ...prev, ...updates }));
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = !!document.fullscreenElement;
      setIsFullscreen(fullscreen);
      // 进入全屏时自动进入禅模式（隐藏侧边栏）
      if (fullscreen && !isZenMode) {
        onToggleZenMode();
      }
      // 退出全屏时退出禅模式
      if (!fullscreen && isZenMode) {
        onToggleZenMode();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isZenMode, onToggleZenMode]);

  // 处理全屏切换
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('无法进入全屏模式:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // 处理AI解读按钮点击
  const handleAIAnalysis = () => {
    onRightTabChange("ai-analysis");
    if (isRightSidebarCollapsed) {
      onToggleRightSidebar();
    }
  };

  // 处理批注按钮点击
  const handleAnnotations = () => {
    if (isRightSidebarCollapsed) {
      // 如果侧边栏关闭，打开并展开
      onRightTabChange("annotations");
      onToggleRightSidebar();
      if (isSidebarCompact) onToggleCompact(); // 确保展开
    } else {
      // 侧边栏已打开
      if (activeRightTab !== "annotations") {
        // 如果当前不是批注 Tab，切换到批注并展开
        onRightTabChange("annotations");
        if (isSidebarCompact) onToggleCompact();
      } else {
        // 如果当前是批注 Tab，切换展开/收起状态
        onToggleCompact();
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      {/* 注入 source_url 到 window 供 ViewSwitcher 使用 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.note_source_url = ${JSON.stringify(note.source_url)};`,
        }}
      />
      {/* 阅读进度条 */}
      <div
        className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* 左侧：导航与路径 */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="shrink-0 text-[15px] font-medium"
          >
            <ArrowLeft className="h-[18px] w-[18px] mr-1" />
            返回
          </Button>

          {/* 面包屑导航 */}
          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <Home className="h-3.5 w-3.5 shrink-0" />
            <span className="mx-1">/</span>
            {folder && (
              <>
                <span className="truncate">{folder.name}</span>
                <span className="mx-1">/</span>
              </>
            )}
            <span className="truncate max-w-[200px]">{note.title || "无标题"}</span>
          </div>
        </div>

        {/* 中间：视图切换器 */}
        <div className="hidden lg:block">
          <ViewSwitcher 
            currentView={currentView} 
            onViewChange={onViewChange} 
            sourceUrl={note.source_url}
          />
        </div>

        {/* 右侧：工具箱 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 第一组：设置和视图控制 */}
          {/* 阅读器样式 */}
          <AppearanceMenu contentType={note.content_type} currentView={currentView} />

          {/* 全屏切换 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "退出全屏" : "进入全屏"}
            className="hidden lg:flex"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {/* 更多操作 */}
          <ActionMenu note={currentNote} onNoteChange={handleNoteChange} />

          {/* 分割线 */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* 第二组：AI和批注 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAIAnalysis}
            className="hidden md:flex text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm font-medium"
            title="AI解读"
          >
            <Sparkles className="h-4 w-4 mr-1.5 text-blue-500" />
            <span className="hidden lg:inline">AI解读</span>
          </Button>

          {/* 内容批注 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAnnotations}
            className={cn(
              "hidden md:flex relative transition-colors duration-200 text-sm font-medium",
              !isRightSidebarCollapsed && activeRightTab === "annotations" && !isSidebarCompact && "bg-slate-100 text-slate-900",
              !isRightSidebarCollapsed && activeRightTab === "annotations" && isSidebarCompact && "bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
            )}
            title={isSidebarCompact ? "展开批注" : "收起批注"}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            <span className="hidden lg:inline">
              {!isRightSidebarCollapsed && activeRightTab === "annotations" && isSidebarCompact ? "展开" : "批注"}
            </span>
            {annotationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {annotationCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

