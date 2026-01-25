/**
 * ============================================================================
 * Reader Layout Component (阅读器三栏布局组件)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 实现沉浸式阅读页面的三栏布局：
 * - 左侧栏：智能大纲（图文）或智能章节（视频）
 * - 中间区：内容舞台（根据视图类型切换渲染器）
 * - 右侧栏：智库面板（批注列表、AI 解读、逐字稿）
 *
 * 架构位置：
 * ---------
 * 位于 `components/reader/` 目录，是阅读页的核心布局容器。
 *
 * 组件层级：
 * ---------
 * app/notes/[id]/page.tsx (数据加载)
 *   └── ReaderLayout.tsx (本组件 - 布局容器)
 *       ├── GlobalHeader/ (顶部导航)
 *       ├── LeftSidebar/ (左侧栏)
 *       ├── ContentStage/ (中间内容区)
 *       └── RightSidebar/ (右侧栏)
 *
 * 核心功能：
 * ---------
 * 1. **视图切换**：支持 4 种视图模式
 *    - reader: 沉浸阅读（默认）
 *    - web: 原始网页（iframe）
 *    - ai-brief: AI 速览
 *    - archive: 网页存档
 *
 * 2. **禅模式**：一键收起左右侧栏，专注内容
 *    - 快捷键：Esc 退出
 *    - 顶部进度条始终可见
 *
 * 3. **侧边栏控制**：
 *    - 左侧栏：可折叠（默认展开）
 *    - 右侧栏：可折叠，支持紧凑模式（60px 或 380px）
 *
 * 4. **阅读进度追踪**：
 *    - 顶部进度条：显示滚动百分比
 *    - 自动保存阅读位置（数据库）
 *
 * 状态管理：
 * ---------
 * 使用 React Hooks (useState, useEffect) 管理组件内部状态。
 * 未来如果状态复杂，可以考虑迁移到 Zustand 或 Context API。
 *
 * 响应式设计：
 * ---------
 * - 桌面端 (≥1024px): 三栏完整显示
 * - 平板端 (768px-1023px): 左侧栏自动隐藏
 * - 移动端 (<768px): 左右侧栏都隐藏，通过按钮切换
 *
 * @module components/reader/ReaderLayout
 */

"use client";

import { useState, useEffect } from "react";
import { GlobalHeader } from "./GlobalHeader";
import { LeftSidebar } from "./LeftSidebar";
import { ContentStage } from "./ContentStage";
import { RightSidebar } from "./RightSidebar";
import { cn } from "@/lib/utils";
import { PanelRight, Tag, Folder, Star, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { MoveToFolderDialog } from "./GlobalHeader/MoveToFolderDialog";
import { TagPopup } from "./GlobalHeader/TagPopup";

// ============================================================================
// Type Definitions (类型定义)
// ============================================================================

/**
 * 笔记数据结构
 *
 * 包含从数据库查询的笔记完整信息。
 */
interface Note {
  /** 笔记 ID */
  id: string;
  /** 原始 URL */
  source_url: string;
  /** 内容类型：article=图文，video=视频，audio=音频 */
  content_type: "article" | "video" | "audio";
  /** 标题 */
  title: string | null;
  /** 作者 */
  author: string | null;
  /** 来源站点名称 */
  site_name: string | null;
  /** 封面图 URL */
  cover_image_url: string | null;
  /** 摘要 */
  excerpt: string | null;
  /** HTML 格式内容 */
  content_html: string | null;
  /** 纯文本内容 */
  content_text: string | null;
  /** 媒体 URL（视频/音频）*/
  media_url: string | null;
  /** 媒体时长（秒）*/
  media_duration: number | null;
  /** 阅读状态：unread/reading/archived */
  status: string;
  /** 创建时间 */
  created_at: string;
  /** 发布时间 */
  published_at: string | null;
  /** 阅读位置（像素）*/
  reading_position?: number;
  /** 阅读百分比 (0-100) */
  read_percentage?: number;
  /** 预估阅读时间（分钟）*/
  estimated_read_time?: number;
  /** 阅读器偏好设置（JSON）*/
  reader_preferences?: any;
  /** 是否已星标 */
  is_starred?: boolean;
  /** 所属文件夹 ID */
  folder_id?: string | null;
}

/**
 * 文件夹数据结构
 */
interface Folder {
  /** 文件夹 ID */
  id: string;
  /** 文件夹名称 */
  name: string;
  /** 父文件夹 ID */
  parent_id: string | null;
}

/**
 * 组件 Props
 */
interface ReaderLayoutProps {
  /** 当前笔记数据 */
  note: Note;
  /** 所属文件夹（可能为 null）*/
  folder: Folder | null;
}

/**
 * 视图类型
 *
 * 定义中间内容区可以显示的不同视图模式。
 */
export type ViewType = "reader" | "web" | "ai-brief" | "archive";

/**
 * 右侧面板 Tab 类型
 *
 * 定义右侧栏可以显示的不同功能面板。
 */
export type RightPanelTab = "annotations" | "ai-analysis" | "transcript";

// ============================================================================
// Component (组件实现)
// ============================================================================

/**
 * ReaderLayout 主组件
 *
 * 业务流程：
 * ---------
 * 1. 初始化各部分的状态（视图模式、侧边栏展开状态等）
 * 2. 监听滚动事件，更新顶部进度条
 * 3. 监听键盘事件，支持快捷键操作
 * 4. 监听自定义事件，支持子组件通信
 * 5. 渲染三栏布局
 *
 * 自定义事件通信：
 * ---------------
 * - `reader:has-annotations`: 子组件通知有批注，自动展开右侧栏
 * - `reader:switch-tab`: 子组件通知切换右侧栏 Tab
 *
 * @param props - 组件属性
 * @param props.note - 当前笔记数据
 * @param props.folder - 所属文件夹
 */
export function ReaderLayout({ note, folder }: ReaderLayoutProps) {
  // ========================================================================
  // 状态管理 (State Management)
  // ========================================================================

  /** 当前视图模式（默认沉浸阅读）*/
  const [currentView, setCurrentView] = useState<ViewType>("reader");

  /** 禅模式状态（收起所有侧栏）*/
  const [isZenMode, setIsZenMode] = useState(false);

  /** 左侧栏折叠状态（默认展开）*/
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);

  /** 右侧栏折叠状态（默认折叠）*/
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);

  /** 右侧栏紧凑模式状态（60px 宽 vs 380px 宽）*/
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);

  /** 是否有批注（用于自动展开右侧栏）*/
  const [hasAnnotations, setHasAnnotations] = useState(false);

  /** 右侧栏当前激活的 Tab */
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>("annotations");

  /** 阅读进度百分比 (0-100) */
  const [scrollProgress, setScrollProgress] = useState(0);

  /** 星标状态 */
  const [isStarred, setIsStarred] = useState(note.is_starred || false);

  /** 移动到文件夹对话框状态 */
  const [showMoveFolderDialog, setShowMoveFolderDialog] = useState(false);

  /** 标签弹出层状态 */
  const [showTagPopup, setShowTagPopup] = useState(false);

  /** 本地 folder 状态（用于动态更新）*/
  const [localFolder, setLocalFolder] = useState<Folder | null>(folder);

  /** 本地 note 状态（用于动态更新 folder_id）*/
  const [localNote, setLocalNote] = useState(note);

  /** 标签列表状态 */
  const [noteTags, setNoteTags] = useState<Array<{ id: string; name: string; color: string | null }>>([]);

  const supabase = createClient();

  // 同步 props 中的 folder 到本地状态
  useEffect(() => {
    setLocalFolder(folder);
  }, [folder]);

  // 同步 props 中的 note 到本地状态
  useEffect(() => {
    setLocalNote(note);
  }, [note]);

  // 加载笔记的标签
  useEffect(() => {
    const fetchNoteTags = async () => {
      const { data, error } = await supabase
        .from("note_tags")
        .select("tag_id, tags(id, name, color)")
        .eq("note_id", note.id);

      if (!error && data) {
        const tags = data
          .map((nt: any) => nt.tags)
          .filter((tag: any) => tag);
        setNoteTags(tags);
      }
    };

    fetchNoteTags();
  }, [note.id, supabase]);

  // 切换星标状态
  const handleToggleStar = async () => {
    const newStarredState = !isStarred;
    const { error } = await supabase
      .from("notes")
      .update({ is_starred: newStarredState })
      .eq("id", note.id);

    if (error) {
      console.error("星标更新失败:", error);
      toast.error("操作失败，请重试");
      return;
    }

    setIsStarred(newStarredState);
    toast.success(newStarredState ? "已设为星标" : "已取消星标");

    // 派发自定义事件，通知其他组件（如 ActionMenu）状态已更新
    window.dispatchEvent(new CustomEvent('reader:star-changed', {
      detail: { isStarred: newStarredState }
    }));
  };

  // 移除标签
  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase
      .from("note_tags")
      .delete()
      .eq("note_id", localNote.id)
      .eq("tag_id", tagId);

    if (error) {
      console.error("移除标签失败:", error);
      toast.error("操作失败，请重试");
      return;
    }

    // 更新本地状态
    setNoteTags((prev) => prev.filter((tag) => tag.id !== tagId));
    toast.success("标签已移除");
  };

  // 同步 note 中的星标状态
  useEffect(() => {
    setIsStarred(note.is_starred || false);
  }, [note.is_starred]);

  // 监听来自 ActionMenu 的星标状态变化事件
  useEffect(() => {
    const handleStarChanged = (e: any) => {
      if (e.detail?.isStarred !== undefined) {
        setIsStarred(e.detail.isStarred);
      }
    };

    window.addEventListener('reader:star-changed', handleStarChanged);
    return () => window.removeEventListener('reader:star-changed', handleStarChanged);
  }, []);

  // 监听文件夹变化事件
  useEffect(() => {
    const handleFolderChanged = async (e: any) => {
      const newFolderId = e.detail?.folderId;

      if (newFolderId === undefined) return;

      // 更新本地 note 的 folder_id
      setLocalNote((prev) => ({ ...prev, folder_id: newFolderId }));

      // 如果移到了未分类，清除 folder 状态
      if (newFolderId === null) {
        setLocalFolder(null);
        return;
      }

      // 否则重新获取文件夹信息
      const { data: folderData } = await supabase
        .from("folders")
        .select("*")
        .eq("id", newFolderId)
        .single();

      if (folderData) {
        setLocalFolder(folderData);
      }
    };

    window.addEventListener('reader:folder-changed', handleFolderChanged);
    return () => window.removeEventListener('reader:folder-changed', handleFolderChanged);
  }, [supabase]);

  // 监听标签变化事件
  useEffect(() => {
    const handleTagsChanged = async (e: any) => {
      const updatedTagIds = e.detail?.tagIds;

      if (updatedTagIds === undefined) return;

      // 重新加载标签
      if (updatedTagIds.length === 0) {
        setNoteTags([]);
        return;
      }

      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .in("id", updatedTagIds);

      if (!error && data) {
        setNoteTags(data);
      }
    };

    window.addEventListener('reader:tags-changed', handleTagsChanged);
    return () => window.removeEventListener('reader:tags-changed', handleTagsChanged);
  }, [supabase]);

  // 实时删除标签
  const handleDeleteTag = async (tagId: string) => {
    // 从数据库删除标签关联
    const { error } = await supabase
      .from("note_tags")
      .delete()
      .eq("note_id", localNote.id)
      .eq("tag_id", tagId);

    if (error) {
      console.error("删除标签失败:", error);
      toast.error("删除标签失败，请重试");
      return;
    }

    // 更新本地状态
    setNoteTags((prev) => prev.filter((tag) => tag.id !== tagId));
    toast.success("标签已删除");
  };

  // ========================================================================
  // 副作用：批注监听
  // ========================================================================

  /**
   * 监听批注创建事件
   *
   * 业务意图：
   * ---------
   * 当用户创建第一个批注时，自动展开右侧栏显示批注列表。
   * 这样用户可以立即看到批注结果，提升交互体验。
   *
   * 实现方式：
   * ---------
   * 使用自定义事件 `reader:has-annotations` 进行跨组件通信。
   * 子组件（如 AnnotationDialog）在创建批注后派发事件。
   *
   * @example
   * ```ts
   * // 在子组件中派发事件
   * window.dispatchEvent(new CustomEvent('reader:has-annotations', {
   *   detail: { count: 1 }
   * }));
   * ```
   */
  useEffect(() => {
    const handleHasAnnotations = (e: any) => {
      // 只有当批注数量 > 0 且当前还未标记有批注时才展开
      // 避免重复展开
      if (e.detail?.count > 0 && !hasAnnotations) {
        setRightSidebarCollapsed(false);
        setHasAnnotations(true);
      }
    };

    window.addEventListener("reader:has-annotations", handleHasAnnotations);

    // 清理函数：移除事件监听器
    return () => window.removeEventListener("reader:has-annotations", handleHasAnnotations);
  }, [hasAnnotations]);

  // ========================================================================
  // 副作用：滚动进度追踪
  // ========================================================================

  /**
   * 监听页面滚动事件，更新阅读进度
   *
   * 业务价值：
   * ---------
   * 1. 用户可以直观看到阅读进度（顶部进度条）
   * 2. 自动保存阅读位置到数据库（断点续读）
   * 3. 统计阅读时长和完成度
   *
   * 计算逻辑：
   * ---------
   * progress = (scrollTop / (docHeight - windowHeight)) * 100
   *
   * - scrollTop: 当前滚动位置
   * - docHeight: 文档总高度
   * - windowHeight: 窗口高度
   *
   * 边界条件：
   * ---------
   * - docHeight = 0: 返回 0（避免除以 0）
   * - progress < 0: 返回 0
   * - progress > 100: 返回 100
   *
   * 性能优化：
   * ---------
   * 这里使用原生 addEventListener，性能优于 React 的 onScroll。
   * 如果需要进一步优化，可以使用 requestAnimationFrame 节流。
   */
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener("scroll", handleScroll);

    // 清理函数：移除事件监听器
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ========================================================================
  // 副作用：快捷键与事件监听
  // ========================================================================

  /**
   * 监听键盘事件和自定义事件
   *
   * 功能列表：
   * ---------
   * 1. Esc 键：退出禅模式
   * 2. `reader:switch-tab` 事件：切换右侧栏 Tab
   *
   * 为什么使用自定义事件？
   * ------------------------
   * - 避免通过 props 层层传递回调函数
   * - 解耦组件之间的依赖
   * - 支持跨层级通信（如 ContentStage → ReaderLayout）
   */
  useEffect(() => {
    // Esc 键退出禅模式
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    };

    // 切换右侧栏 Tab（由子组件派发）
    const handleSwitchTab = (e: any) => {
      if (e.detail?.tab) {
        setActiveRightTab(e.detail.tab);
        setRightSidebarCollapsed(false); // 自动展开右侧栏
        setIsZenMode(false); // 退出禅模式
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("reader:switch-tab", handleSwitchTab);

    // 清理函数：移除所有事件监听器
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("reader:switch-tab", handleSwitchTab);
    };
  }, [isZenMode]);

  // ========================================================================
  // 渲染 (Render)
  // ========================================================================

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-blue-100 selection:text-blue-900 dark:selection:bg-blue-900/30 dark:selection:text-blue-200">
      {/* ========================================================================
          顶部导航栏 (Global Header)
          ========================================================================

          包含：
          - 返回按钮 + 面包屑导航
          - 视图切换器（reader/web/ai-brief/archive）
          - 外观设置按钮
          - 更多操作菜单
          - 右侧栏切换按钮
          - 阅读进度条（顶部极细）
      */}
      <GlobalHeader
        note={note}
        folder={folder}
        currentView={currentView}
        onViewChange={setCurrentView}
        isZenMode={isZenMode}
        onToggleZenMode={() => setIsZenMode(!isZenMode)}
        scrollProgress={scrollProgress}
        onToggleRightSidebar={() => {
          // 切换右侧栏展开/折叠
          setRightSidebarCollapsed(!rightSidebarCollapsed);
          // 如果是从折叠状态展开，退出禅模式
          if (rightSidebarCollapsed) {
            setIsZenMode(false);
          }
        }}
        activeRightTab={activeRightTab}
        onRightTabChange={setActiveRightTab}
        isRightSidebarCollapsed={rightSidebarCollapsed}
        isSidebarCompact={isSidebarCompact}
        onToggleCompact={() => setIsSidebarCompact(!isSidebarCompact)}
      />

      {/* ========================================================================
          三栏主容器 (Three-Column Layout)
          ========================================================================

          布局说明：
          ---------
          - 左侧栏：固定定位，绝对定位在左边，不影响中间居中
          - 中间区：flex-1 自适应，内容水平居中
          - 右侧栏：固定定位，从右侧滑入

          响应式：
          ---------
          - 桌面端 (≥1024px): 三栏都显示
          - 平板/移动端 (<1024px): 左侧栏隐藏 (hidden lg:block)
      */}
      <div className="flex-1 flex overflow-hidden relative justify-center">
        {/* -----------------------------------------------------------------------
            左侧栏 - 大纲/章节 (Left Sidebar)
            -----------------------------------------------------------------------

            功能：
            - 图文模式：显示文章大纲（H1-H3 标题）
            - 视频模式：显示智能章节

            显示条件：
            - 不在禅模式
            - 未折叠
            - 桌面端 (lg 断点以上)
        */}
        {!isZenMode && !leftSidebarCollapsed && (
          <aside
            className={cn(
              // 固定定位 + 层级控制
              "absolute left-0 top-0 bottom-[48px] w-[240px] bg-background/70 backdrop-blur-sm overflow-y-auto transition-all duration-300 border-r border-border/50 z-30", 
              // 响应式：小屏幕隐藏
              "hidden lg:block"
            )}
          >
            <LeftSidebar
              note={note}
              currentView={currentView}
              onCollapse={() => setLeftSidebarCollapsed(true)}
            />
          </aside>
        )}

        {/* -----------------------------------------------------------------------
            中间内容区 (Content Stage)
            -----------------------------------------------------------------------

            功能：
            - 根据 currentView 渲染不同内容
            - 内容水平居中（类似 Medium 的阅读体验）

            视图类型：
            - reader: 图文阅读器 / 视频播放器
            - web: iframe 嵌入原网页
            - ai-brief: AI 速览卡片
            - archive: 网页存档
        */}
        <main
          className={cn(
            "flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-background scrollbar-hide",
            // 禅模式下保持全宽（实际上不需要这个条件，因为侧栏已经隐藏）
            isZenMode ? "max-w-full" : "max-w-full"
          )}
        >
          {/* 内容水平居中容器 */}
          <div className="w-full flex justify-center pb-24">
            <ContentStage note={note} currentView={currentView} />
          </div>
        </main>

        {/* -----------------------------------------------------------------------
            右侧栏 - 批注/AI/逐字稿 (Right Sidebar)
            -----------------------------------------------------------------------

            功能：
            - 批注列表：显示所有高亮和笔记
            - AI 解读：多视角分析
            - 逐字稿：视频/音频转写（仅视频/音频模式）

            显示逻辑：
            - 禅模式下：完全隐藏
            - 折叠时：宽度为 0，完全隐藏（translate-x-full）
            - 展开时：380px 宽
            - 紧凑模式：60px 宽（只显示图标）

            动画效果：
            - 使用 translate-x 和 opacity 实现滑入滑出
            - 持续时间：500ms（ease-in-out）
        */}
        {!isZenMode && (
          <aside
            className={cn(
              "fixed top-[56px] right-0 bottom-[48px] bg-background border-l border-border transition-all duration-500 ease-in-out z-40 shadow-2xl xl:shadow-none",
              // 折叠状态
              rightSidebarCollapsed
                ? "w-0 opacity-0 pointer-events-none translate-x-full"
                : (isSidebarCompact ? "w-[60px]" : "w-[380px]") + " opacity-100 translate-x-0"
            )}
          >
            <RightSidebar
              note={note}
              activeTab={activeRightTab}
              onTabChange={setActiveRightTab}
              onCollapse={() => setRightSidebarCollapsed(true)}
              isCompact={isSidebarCompact}
              onToggleCompact={() => setIsSidebarCompact(!isSidebarCompact)}
            />
          </aside>
        )}

        {/* -----------------------------------------------------------------------
            底部固定导航栏 (Bottom Navigation Bar)
            -----------------------------------------------------------------------

            功能：
            - 快速添加标签
            - 显示当前文件夹
            - 切换右侧栏按钮

            设计：
            - 高度：48px
            - 背景：半透明白色 + 毛玻璃效果
            - 层级：z-[60]（最高，确保在最上层）
            - 禅模式下隐藏，提供沉浸体验
        */}
        {!isZenMode && (
          <div className="fixed bottom-0 left-0 right-0 h-[48px] bg-background/80 backdrop-blur-md border-t border-border z-[60] flex items-center justify-center">
            {/* 左侧：快捷操作 */}
            <div className="flex-1 flex items-center justify-center gap-6">
              {/* 标签区域 */}
              <div className="relative flex items-center gap-2 min-w-0">
                <div
                  onClick={() => setShowTagPopup(!showTagPopup)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-w-0 cursor-pointer"
                >
                  <Tag className="h-3.5 w-3.5 flex-shrink-0" />
                  {/* 显示标签列表 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {noteTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all bg-sky-400/15 text-sky-600 border border-sky-400/25 backdrop-blur-sm shadow-sm hover:bg-sky-400/25 dark:bg-sky-400/20 dark:text-sky-300 dark:border-sky-400/30 dark:hover:bg-sky-400/30"
                        title={tag.name}
                      >
                        {tag.name}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTag(tag.id);
                          }}
                          className="ml-0.5 hover:text-sky-800 transition-colors dark:hover:text-sky-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* 始终显示添加提示 */}
                  <span className="text-[12px] text-muted-foreground hover:text-primary transition-colors font-medium">
                    {noteTags.length > 0 ? "+ 添加" : "添加标签..."}
                  </span>
                </div>

                {/* 标签弹出层 */}
                {showTagPopup && (
                  <TagPopup
                    noteId={localNote.id}
                    currentTagIds={noteTags.map((t) => t.id)}
                    isOpen={showTagPopup}
                    onClose={() => setShowTagPopup(false)}
                    onSuccess={() => {
                      // 重新加载标签
                      supabase
                        .from("note_tags")
                        .select("tag_id, tags(id, name, color)")
                        .eq("note_id", localNote.id)
                        .then(({ data }) => {
                          if (data) {
                            const tags = data
                              .map((nt: any) => nt.tags)
                              .filter((tag: any) => tag);
                            setNoteTags(tags);
                          }
                        });
                    }}
                  />
                )}
              </div>

              {/* 分隔线 */}
              <div className="w-px h-3 bg-border flex-shrink-0" />

              {/* 星标按钮 */}
              <button
                onClick={handleToggleStar}
                className={cn(
                  "flex items-center gap-2 transition-colors flex-shrink-0",
                  isStarred
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Star className={cn("h-3.5 w-3.5", isStarred && "fill-yellow-500")} />
                <span className="text-[12px]">
                  {isStarred ? "已星标" : "设为星标"}
                </span>
              </button>

              {/* 分隔线 */}
              <div className="w-px h-3 bg-border flex-shrink-0" />

              {/* 当前文件夹 */}
              <button
                onClick={() => setShowMoveFolderDialog(true)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title={localFolder?.name || (localNote.folder_id ? "未知收藏夹" : "未分类")}
              >
                <Folder className="h-3.5 w-3.5" />
                <span className="text-[12px]">{localFolder?.name || (localNote.folder_id ? "未知收藏夹" : "未分类")}</span>
              </button>
            </div>

            {/* 右侧：右侧栏切换按钮 */}
            <div className="absolute right-6 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
                className={cn(
                  "h-8 w-8 rounded-lg transition-all duration-300",
                  // 展开时深色背景，折叠时浅色
                  !rightSidebarCollapsed ? "bg-slate-900 text-white hover:bg-slate-800" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------------
          禅模式浮动提示 (Zen Mode Hint)
          -----------------------------------------------------------------------

          功能：
            - 提示用户按 Esc 可退出禅模式
            - 3秒后自动淡出
            - 仅在进入禅模式时显示一次
        */}
        <AnimatePresence>
          {isZenMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-sm flex items-center gap-3">
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono border border-slate-600">Esc</kbd>
                <span className="text-sm">退出禅模式</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 移动到文件夹对话框 */}
        <MoveToFolderDialog
          noteId={localNote.id}
          currentFolderId={localNote.folder_id || null}
          isOpen={showMoveFolderDialog}
          onClose={() => setShowMoveFolderDialog(false)}
          onSuccess={(newFolderId) => {
            // 更新本地 note 的 folder_id
            setLocalNote((prev) => ({ ...prev, folder_id: newFolderId }));

            // 如果移到了未分类，清除 folder 状态
            if (newFolderId === null) {
              setLocalFolder(null);
              return;
            }

            // 否则重新获取文件夹信息
            supabase
              .from("folders")
              .select("*")
              .eq("id", newFolderId)
              .single()
              .then(({ data }) => {
                if (data) {
                  setLocalFolder(data);
                }
              });
          }}
        />
      </div>
    </div>
  );
}
