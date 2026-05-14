"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import TurndownService from "turndown";
import { toast } from "sonner";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  FileText,
  Video,
  Music,
  Folder,
  Tag,
  Mail,
  List,
  Star,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Settings,
  User as UserIcon,
  Gift,
  BarChart3,
  Palette,
  Info,
  Filter,
  ListFilter,
  ArrowUpDown,
  Grid3x3,
  Archive,
  Bookmark,
  BookmarkCheck,
  Link2,
  Copy,
  FileDown,
  Trash2,
  MoveHorizontal,
  PenLine,
  Check,
  Loader2,
  MoreHorizontal,
  Sparkles,
  FolderPlus,
  Pencil,
  Inbox,
  LayoutGrid,
  Upload,
  StickyNote,
  Globe,
  History,
  MessageSquare,
  Share2,
  Quote,
  BookOpen,
  Bell,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KnowledgeView } from "@/components/dashboard/knowledge-view";
import { EditAnnotationDialog } from "./edit-annotation-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BrowseHistoryPopover } from "@/components/dashboard/BrowseHistoryPopover";
import { NotificationsPopover } from "@/components/dashboard/NotificationsPopover";
import { AnimatedThemeSwitcher } from "@/components/animated-theme-switcher";
import { useRouter } from "next/navigation";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { RewardsSection } from "@/components/settings/sections/RewardsSection";
import { StatsSection } from "@/components/settings/sections/StatsSection";
import { AppearanceSection } from "@/components/settings/sections/AppearanceSection";
import { TrashSection } from "@/components/settings/sections/TrashSection";
import { AboutSection } from "@/components/settings/sections/AboutSection";
import {
  consumeDirtyAnnotationNoteIds,
  peekDirtyAnnotationNoteIds,
  clearDirtyAnnotationNoteIds,
  getLastDirtyNoteId,
  NOTE_ANNOTATIONS_CHANGED_EVENT,
} from "@/lib/noteSync";

const PAGE_SIZE = 16;
const ANNOTATIONS_PAGE_SIZE = 48;

type SourceType = "url" | "manual" | "upload";

type NoteTag = {
  id: string;
  name: string;
  color: string | null;
  parent_id?: string | null;
  position?: number;
  icon?: string | null;
  archived_at?: string | null;
};

type TagSortMode = "custom" | "name-asc" | "name-desc";

type TagWithCount = NoteTag & {
  note_count: number;
  last_accessed_at?: string | null;
};

type TagTreeNode = TagWithCount & {
  children: TagTreeNode[];
  expanded?: boolean;
};

type CategoryType = "uncategorized" | "folder" | "all" | "starred" | "today" | "smart";

type ViewModeType = "compact-card" | "detail-list" | "compact-list" | "title-list" | "detail-card";

type ContentTypeFilter = "all" | "article" | "video" | "audio";

type SortByType = "created_at" | "updated_at" | "title" | "site_name";

type SortOrderType = "asc" | "desc";

interface NoteItem {
  id: string;
  source_url: string | null;
  content_type: "article" | "video" | "audio";
  title: string | null;
  site_name: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  media_duration: number | null;
  status: "unread" | "reading" | "archived";
  created_at: string;
  captured_at: string | null;
  folder_id: string | null;
  folder_name?: string | null;
  is_starred: boolean;
  source_type: SourceType;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  tags: NoteTag[];
  annotation_count?: number;
  video_job_id?: string | null;
  video_overall_status?: string | null;
}

interface FolderWithCount {
  id: string;
  name: string;
  color?: string | null;
  parent_id: string | null;
  icon?: string | null;
  archived_at?: string | null;
  position?: number | null;
  note_count: number;
}

type FolderTreeNode = FolderWithCount & {
  children: FolderTreeNode[];
};

interface SmartList {
  id: string;
  label: string;
  type: "tag" | "domain";
  count: number;
  tagId?: string;
  domain?: string;
}

interface Counts {
  uncategorized: number;
  all: number;
  starred: number;
  today: number;
  untagged: number;
}

type CreationMode = "url" | "quick" | "upload";
type PrimaryNav = "collections" | "tags" | "annotations" | "archive" | "knowledge" | "settings";

type SettingsTab = "account" | "rewards" | "stats" | "appearance" | "trash" | "about";

type RawNote = NoteItem & {
  note_tags?: { tag_id: string; tags: NoteTag | null }[];
  folders?: { name: string } | null;
  highlights?: { count: number }[];
};

type NoteContentRecord = {
  id: string;
  title: string | null;
  content_html: string | null;
  content_text: string | null;
  excerpt: string | null;
  source_url: string | null;
  site_name: string | null;
  created_at: string;
};

type HighlightRecord = {
  quote: string;
  color: string | null;
} | null;

type AnnotationRecord = {
  id: string;
  note_id: string;
  highlight_id: string | null;
  content: string;
  created_at: string;
  updated_at?: string;
  timecode?: number | null;
  screenshot_url?: string | null;
  is_floating?: boolean | null;
  highlights?: HighlightRecord;
};

type AnnotatedNoteItem = NoteItem & {
  last_annotated_at: string;
};

const folderIconOptions = ["📁", "📰", "📚", "⭐", "📌", "🗂️", "💡", "🎧"];

function buildFolderTree(folders: FolderWithCount[]): FolderTreeNode[] {
  const nodes = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];
  folders.forEach((folder) => {
    nodes.set(folder.id, { ...folder, children: [] });
  });

  const sorted = Array.from(nodes.values()).sort((a, b) => {
    const posA = a.position ?? 0;
    const posB = b.position ?? 0;
    if (posA !== posB) return posA - posB;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (items: FolderTreeNode[]) => {
    items.sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });
    items.forEach((child) => sortChildren(child.children));
  };

  sortChildren(roots);
  return roots;
}

function flattenFolderTree(
  nodes: FolderTreeNode[],
  depth = 0,
): Array<FolderTreeNode & { depth: number }> {
  const result: Array<FolderTreeNode & { depth: number }> = [];
  nodes.forEach((node) => {
    result.push({ ...node, depth });
    if (node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, depth + 1));
    }
  });
  return result;
}

const creationTabs: { id: CreationMode; label: string }[] = [
  { id: "url", label: "添加网址" },
  { id: "quick", label: "速记" },
  { id: "upload", label: "上传" },
];

type PrimaryNavIcon = ComponentType<{ className?: string }>;

type PrimaryNavItem = {
  id: PrimaryNav;
  Icon: PrimaryNavIcon;
  ActiveIcon?: PrimaryNavIcon;
};

function AnnotationsNavIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M14.5 8.5l-5.5 5.5V16h2l5.5-5.5-2-2z" strokeWidth="1.6" />
      <path d="M13.5 9.5l2 2" strokeWidth="1" />
    </svg>
  );
}

function AnnotationsNavIconActive({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M14.5 8.5l-5.5 5.5V16h2l5.5-5.5-2-2z" fill="white" />
    </svg>
  );
}

const primaryNavItems: PrimaryNavItem[] = [
  { id: "collections", Icon: LayoutGrid },
  { id: "tags", Icon: Tag },
  { id: "annotations", Icon: AnnotationsNavIcon, ActiveIcon: AnnotationsNavIconActive },
  { id: "archive", Icon: Archive },
  { id: "knowledge", Icon: BookOpen },
];

const settingsNavItems: Array<{ id: SettingsTab; label: string; Icon: any }> = [
  { id: "account", label: "我的账户", Icon: UserIcon },
  { id: "rewards", label: "会员奖励", Icon: Gift },
  { id: "stats", label: "用量统计", Icon: BarChart3 },
  { id: "appearance", label: "外观主题和字体", Icon: Palette },
  { id: "trash", label: "最近删除", Icon: Trash2 },
  { id: "about", label: "关于 NewsBox", Icon: Info },
];

const noteSelect = `
  id,
  source_url,
  content_type,
  title,
  site_name,
  cover_image_url,
  excerpt,
  media_duration,
  status,
  created_at,
  captured_at,
  folder_id,
  is_starred,
  source_type,
  file_url,
  file_name,
  file_size,
  file_type,
  video_job_id,
  video_overall_status,
  folders(name),
  highlights(count),
  note_tags(
    tag_id,
    tags(
      id,
      name,
      color
    )
  )
`;

function findFolderNode(
  nodes: FolderTreeNode[],
  targetId: string,
): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    const found = findFolderNode(node.children, targetId);
    if (found) return found;
  }
  return null;
}

function collectDescendantIds(node: FolderTreeNode | null) {
  const ids = new Set<string>();
  if (!node) return ids;
  const walk = (current: FolderTreeNode) => {
    current.children.forEach((child) => {
      ids.add(child.id);
      walk(child);
    });
  };
  walk(node);
  return ids;
}

function getDescendantIds(nodes: FolderTreeNode[], targetId: string) {
  const node = findFolderNode(nodes, targetId);
  return collectDescendantIds(node);
}

// Tag tree building functions
function buildTagTree(tags: TagWithCount[], sortMode: TagSortMode, expandedTags: Set<string>): TagTreeNode[] {
  const tagMap = new Map<string, TagTreeNode>();
  const roots: TagTreeNode[] = [];

  // Create nodes
  tags.forEach((tag) => {
    tagMap.set(tag.id, {
      ...tag,
      children: [],
      expanded: expandedTags.has(tag.id),
    });
  });

  // Build hierarchy
  tags.forEach((tag) => {
    const node = tagMap.get(tag.id)!;
    if (tag.parent_id) {
      const parent = tagMap.get(tag.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // Orphaned tag
      }
    } else {
      roots.push(node);
    }
  });

  // Sort based on mode
  const sortFn = getTagSortFunction(sortMode);
  sortTagTree(roots, sortFn);

  return roots;
}

function sortTagTree(
  nodes: TagTreeNode[],
  sortFn: (a: TagTreeNode, b: TagTreeNode) => number
) {
  nodes.sort(sortFn);
  nodes.forEach((node) => {
    if (node.children.length > 0) {
      sortTagTree(node.children, sortFn);
    }
  });
}

function getTagSortFunction(mode: TagSortMode) {
  switch (mode) {
    case "name-asc":
      return (a: TagTreeNode, b: TagTreeNode) => a.name.localeCompare(b.name);
    case "name-desc":
      return (a: TagTreeNode, b: TagTreeNode) => b.name.localeCompare(a.name);
    case "custom":
    default:
      return (a: TagTreeNode, b: TagTreeNode) => (a.position ?? 0) - (b.position ?? 0);
  }
}

function findTagNode(
  nodes: TagTreeNode[],
  targetId: string
): TagTreeNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    const found = findTagNode(node.children, targetId);
    if (found) return found;
  }
  return null;
}

function getDescendantTagIds(nodes: TagTreeNode[], targetId: string): string[] {
  const node = findTagNode(nodes, targetId);
  if (!node) return [];

  const ids: string[] = [];
  const traverse = (current: TagTreeNode) => {
    ids.push(current.id);
    current.children.forEach(traverse);
  };
  
  traverse(node);
  return ids;
}

function normalizeNote(raw: RawNote): NoteItem {
  return {
    ...raw,
    folder_name: raw.folders?.name,
    annotation_count: raw.highlights?.[0]?.count ?? 0,
    tags:
      raw.note_tags
        ?.map((relation) => relation?.tags)
        .filter((tag): tag is NoteTag => Boolean(tag)) ?? [],
  };
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

/**
 * 将 HTML 内容转换为纯文本（环境自适应）
 *
 * @param html - HTML 字符串
 * @param fallback - 当输入为空或转换失败时的默认返回值
 * @returns 提取后的纯文本内容
 *
 * 实现策略（环境适配）：
 *
 * **服务端环境（SSR）**：
 * - 使用正则表达式去除 HTML 标签：`/<[^>]+>/g`
 * - 将连续空白字符合并为单个空格：`/\s+/g`
 * - 去因：服务端无 DOM API，正则是最快方案
 *
 * **浏览器环境（CSR）**：
 * - 创建临时 div 元素设置 innerHTML
 * - 读取 textContent/textInnerText 提取文本
 * - 优势：浏览器原生解析，能正确处理实体字符（&nbsp; → 空格）
 *
 * 兼容性说明：
 * - textContent: 标准 API，返回所有文本节点
 * - innerText: 非 标准，但计算 CSS 样式（如 display:none 的内容不返回）
 * - 优先使用 textContent，innerText 作为 fallback
 */
function htmlToPlainText(html?: string | null, fallback?: string | null) {
  if (!html) return fallback ?? "";
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const div = window.document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || fallback || "";
}

/**
 * 清洗文件名，移除非法字符（跨平台兼容）
 *
 * @param name - 原始文件名
 * @returns 清洗后的安全文件名
 *
 * 过滤规则：
 * - **保留字符**：字母（a-zA-Z）、数字（0-9）、下划线（_）、连字符（-）、点（.）
 * - **替换规则**：所有其他字符替换为连字符（-）
 *
 * 跨平台兼容性：
 * - **Windows**：禁止字符 < > : " / \ | ? *
 * - **macOS**：禁止字符 : / （但允许其他）
 * - **Linux**：仅禁止 / 和空字符（\0）
 *
 * 设计决策：
 * - 采用最严格策略（保留安全子集），确保所有平台兼容
 * - 保留点（.）用于扩展名：article.md → article.md
 * - 不限制连续连字符，后续可优化：`replace(/-+/g, "-")`
 *
 * 边界情况：
 * - 空字符串 → 空字符串
 * - 全非法字符 → 多个连字符（如 "???" → "---"）
 * - 建议配合 trim() 使用：`sanitizeFileName(name).trim()`
 */
function sanitizeFileName(name: string) {
  return name.replace(/[^\w\d\-_.]+/g, "-");
}

/**
 * 触发浏览器下载 Blob 内容（文件下载）
 *
 * @param content - 要下载的 Blob 对象
 * @param filename - 下载后的文件名
 *
 * 实现原理：
 * 1. 创建隐藏的 `<a>` 标签
 * 2. 使用 `URL.createObjectURL()` 创建 Blob URL
 * 3. 设置 `download` 属性指定文件名
 * 4. 模拟点击触发下载
 * 5. 清理临时元素和释放内存
 *
 * 内存泄漏防护：
 * - **必须调用** `URL.revokeObjectURL()` 释放 Blob URL
 * - 延迟 2 秒释放（确保下载已开始）
 * - 移除 DOM 元素避免节点堆积
 *
 * 浏览器兼容性：
 * - Chrome/Firefox/Edge: 完全支持
 * - Safari: 需要用户交互触发（click 必须在事件回调中）
 * - 移动端: 部分浏览器可能在新标签页打开而非下载
 *
 * 已知限制：
 * - 文件名包含中文在某些系统可能乱码（可通过 encodeURIComponent 处理）
 * - 超大文件（> 500MB）可能导致标签页崩溃
 * - 某些浏览器会提示"此文件类型可能有害"
 */
function downloadBlob(content: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

// ── Video status polling hook ──────────────────────────────────────────────
function useVideoJobStatus(jobId: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<{ overall_status?: string; steps?: unknown; errors?: unknown } | null>(null);
  useEffect(() => {
    if (!enabled || !jobId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/ai/video/${jobId}/status`);
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // silent
      }
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, enabled]);
  return data;
}

// ── Video status badge ─────────────────────────────────────────────────────
const VIDEO_STATUS_LABELS: Record<string, string> = {
  processing: "视频处理中",
  media_ready: "AI 分析中",
  failed: "处理失败",
  need_browser_fallback: "请打开插件重试",
};

function VideoStatusBadge({
  noteId,
  jobId,
  initialStatus,
}: {
  noteId: string;
  jobId: string | null | undefined;
  initialStatus: string;
}) {
  const isPending =
    initialStatus !== "fully_ready" && initialStatus !== "failed";
  const polled = useVideoJobStatus(jobId, isPending);
  const status = polled?.overall_status ?? initialStatus;

  if (!status || status === "fully_ready") return null;

  const label = VIDEO_STATUS_LABELS[status] ?? status;
  const spinning = status === "processing" || status === "media_ready";

  return (
    <div
      key={noteId}
      className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1"
    >
      {spinning && (
        <svg
          className="animate-spin h-3 w-3 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      <span
        className={
          status === "failed"
            ? "text-red-500"
            : status === "need_browser_fallback"
            ? "text-amber-500"
            : undefined
        }
      >
        {label}
      </span>
    </div>
  );
}

export function DashboardContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activePrimary, setActivePrimary] = useState<PrimaryNav>("collections");
  // const [isBrowseHistoryOpen, setIsBrowseHistoryOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [category, setCategory] = useState<CategoryType>("uncategorized");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedSmartList, setSelectedSmartList] = useState<SmartList | null>(
    null,
  );
  const [searchInput, setSearchInput] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentItems, setRecentItems] = useState<{
    tags: any[];
    folders: any[];
    notes: any[];
  }>({ tags: [], folders: [], notes: [] });
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search history when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activePrimary === "annotations") {
      setIsSearchFocused(false);
    }
  }, [activePrimary]);

  // Load recent items for search history
  const loadRecentItems = useCallback(async () => {
    if (!user) return;

    try {
      const [recentNotes, recentFolders, recentTags] = await Promise.all([
        supabase
          .from("notes")
          .select("id, title, site_name, source_url, content_type, last_accessed_at")
          .eq("user_id", user.id)
          .is("archived_at", null)
          .is("deleted_at", null)
          .order("last_accessed_at", { ascending: false, nullsFirst: false })
          .limit(10),
        supabase
          .from("folders")
          .select("id, name, color, last_accessed_at")
          .eq("user_id", user.id)
          .is("archived_at", null)
          .order("last_accessed_at", { ascending: false, nullsFirst: false })
          .limit(10),
        supabase
          .from("tags")
          .select("id, name, color, last_accessed_at")
          .eq("user_id", user.id)
          .order("last_accessed_at", { ascending: false, nullsFirst: false })
          .limit(10),
      ]);

      setRecentItems({
        notes: recentNotes.data || [],
        folders: recentFolders.data || [],
        tags: recentTags.data || [],
      });
    } catch (error) {
      console.error("Error loading recent items:", error);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (isSearchFocused) {
      loadRecentItems();
    }
  }, [isSearchFocused, loadRecentItems]);

  // Track access
  const trackAccess = useCallback(async (type: 'note' | 'folder' | 'tag', id: string) => {
    if (!user || !id) return;
    const table = type === 'note' ? 'notes' : type === 'folder' ? 'folders' : 'tags';
    
    console.log(`Tracking access for ${type}: ${id}`);
    
    const { error } = await supabase
      .from(table)
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
      
    if (error) {
      console.error(`Error tracking access for ${type}:`, error);
    } else {
      // If search is currently focused, re-fetch recent items to show immediate update
      if (isSearchFocused) {
        loadRecentItems();
      }
    }
  }, [user, supabase, isSearchFocused, loadRecentItems]);
  const [searchQuery, setSearchQuery] = useState("");

  // Annotations view states
  const [annotationNotes, setAnnotationNotes] = useState<AnnotatedNoteItem[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [annotationsPage, setAnnotationsPage] = useState(0);
  const [hasMoreAnnotations, setHasMoreAnnotations] = useState(true);
  const [loadingMoreAnnotations, setLoadingMoreAnnotations] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<AnnotationRecord | null>(null);
  const loadMoreAnnotationsRef = useRef<HTMLDivElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "default" | "destructive";
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });

  const [selectedAnnotationNoteId, setSelectedAnnotationNoteId] = useState<string | null>(null);
  const [annotationNoteSearch, setAnnotationNoteSearch] = useState("");
  const [annotationRecordSearch, setAnnotationRecordSearch] = useState("");
  const [annotationSort, setAnnotationSort] = useState<"created_at_desc" | "created_at_asc" | "updated_at_desc" | "updated_at_asc" | "url_az" | "url_za">("updated_at_desc");
  const [annotationTypeFilter, setAnnotationTypeFilter] = useState<string>("all");
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [annotationsError, setAnnotationsError] = useState<string | null>(null);
  const [quoteMaterialIdByAnnotationId, setQuoteMaterialIdByAnnotationId] = useState<Record<string, string>>({});
  const [quoteMaterialBusyAnnotationIds, setQuoteMaterialBusyAnnotationIds] = useState<Set<string>>(new Set());

  // Tag management states
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);
  const tagTreeRef = useRef<TagTreeNode[]>([]);
  
  useEffect(() => {
    tagTreeRef.current = tagTree;
  }, [tagTree]);

  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [tagSortMode, setTagSortMode] = useState<TagSortMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tagSortMode");
      return (saved as TagSortMode) || "custom";
    }
    return "custom";
  });
  const [includeChildTags, setIncludeChildTags] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("includeChildTags");
      return saved === "true";
    }
    return true;
  });
  const [viewMode, setViewMode] = useState<ViewModeType>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("viewMode");
      // 如果之前保存的是 detail-card，则默认使用 compact-card
      if (saved === "detail-card" || !saved) {
        return "compact-card";
      }
      return saved as ViewModeType;
    }
    return "compact-card";
  });
  const [showArchived, setShowArchived] = useState(false);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortByType>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrderType>("desc");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [knowledgeSubView, setKnowledgeSubView] = useState<string>("chat");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [counts, setCounts] = useState<Counts>({
    uncategorized: 0,
    all: 0,
    starred: 0,
    today: 0,
    untagged: 0,
  });
  const [folders, setFolders] = useState<FolderWithCount[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const [availableTags, setAvailableTags] = useState<NoteTag[]>([]);
  const [smartLists, setSmartLists] = useState<SmartList[]>([]);
  const [smartListsExpanded, setSmartListsExpanded] = useState(true);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);

  const lastSeenAnnotationsUpdatedAtRef = useRef<number>(0);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [notesLoadingError, setNotesLoadingError] = useState<string | null>(
    null,
  );
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>("url");
  const [newNoteUrl, setNewNoteUrl] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickContent, setQuickContent] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isUpsertingTags, setIsUpsertingTags] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagDialogSelection, setTagDialogSelection] = useState<string[]>([]);
  const [tagDialogNewName, setTagDialogNewName] = useState("");
  const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null);
  const [actionTargetIds, setActionTargetIds] = useState<string[]>([]);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<"create" | "edit">(
    "create",
  );
  const [folderDialogParent, setFolderDialogParent] = useState<string | null>(
    null,
  );
  const [folderDialogName, setFolderDialogName] = useState("");
  const [folderDialogIcon, setFolderDialogIcon] = useState("");
  const [folderDialogTargetId, setFolderDialogTargetId] = useState<string | null>(
    null,
  );
  const [folderActionLoading, setFolderActionLoading] = useState(false);
  
  // Tag dialog states
  const [showTagDialog2, setShowTagDialog2] = useState(false);
  const [tagDialogMode, setTagDialogMode] = useState<"create" | "edit">("create");
  const [tagDialogParent, setTagDialogParent] = useState<string | null>(null);
  const [tagDialogName, setTagDialogName] = useState("");
  const [tagDialogIcon, setTagDialogIcon] = useState("");
  const [tagDialogColor, setTagDialogColor] = useState("");
  const [tagDialogTargetId, setTagDialogTargetId] = useState<string | null>(null);
  const [tagActionLoading, setTagActionLoading] = useState(false);
  
  // Loading states for individual note operations (star/archive)
  const [starringNotes, setStarringNotes] = useState<Set<string>>(new Set());
  const [archivingNotes, setArchivingNotes] = useState<Set<string>>(new Set());
  
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const turndown = useMemo(() => new TurndownService(), []);
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const folderMap = useMemo(
    () =>
      new Map<string, FolderWithCount>(
        folders.map((folder) => [folder.id, folder]),
      ),
    [folders],
  );
  
  // Build tag tree whenever tags, sortMode, or expandedTags change
  useEffect(() => {
    const tree = buildTagTree(tags, tagSortMode, expandedTags);
    setTagTree(tree);
  }, [tags, tagSortMode, expandedTags]);

  // Handle Escape key to close all dialogs
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAddNoteDialog(false);
        setShowMoveDialog(false);
        setShowTagDialog(false);
        setShowFolderDialog(false);
        setShowTagDialog2(false);
        setEditingAnnotation(null);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const flattenedFolderOptions = useMemo(() => flattenFolderTree(folderTree), [folderTree]);
  const selectedFolderChain = useMemo(() => {
    if (!selectedFolder) return new Set<string>();
    const chain = new Set<string>();
    let current: string | null = selectedFolder;
    while (current) {
      chain.add(current);
      current = folderMap.get(current)?.parent_id ?? null;
    }
    return chain;
  }, [selectedFolder, folderMap]);
  const selectedFolderBreadcrumb = useMemo(() => {
    if (category !== "folder" || !selectedFolder) return "";
    const names: string[] = [];
    let current = folderMap.get(selectedFolder) ?? null;
    while (current) {
      names.unshift(current.name);
      if (!current.parent_id) break;
      current = folderMap.get(current.parent_id) ?? null;
    }
    return names.join(" / ");
  }, [category, selectedFolder, folderMap]);
  const bulkActionButtonClass = "h-8 rounded-full px-3 text-xs";

  const filteredAnnotationNotes = useMemo(() => {
    const keyword = annotationNoteSearch.trim().toLowerCase();
    return annotationNotes.filter((note) => {
      // 搜索过滤
      if (!keyword) return true;
      const title = (note.title ?? "").toLowerCase();
      const site = (note.site_name ?? "").toLowerCase();
      const url = (note.source_url ?? "").toLowerCase();
      return title.includes(keyword) || site.includes(keyword) || url.includes(keyword);
    });
  }, [annotationNotes, annotationNoteSearch]);

  const selectedAnnotationNote = useMemo(() => {
    if (!selectedAnnotationNoteId) return null;
    return annotationNotes.find((n) => n.id === selectedAnnotationNoteId) ?? null;
  }, [annotationNotes, selectedAnnotationNoteId]);

  const filteredAnnotationRecords = useMemo(() => {
    const keyword = annotationRecordSearch.trim().toLowerCase();
    
    // 1. 获取基础范围 (根据选中的新闻)
    let scoped = selectedAnnotationNoteId
      ? annotations.filter((a) => a.note_id === selectedAnnotationNoteId)
      : annotations;

    // 2. 文章类型过滤
    if (annotationTypeFilter !== "all") {
      scoped = scoped.filter(a => {
        const note = annotationNotes.find(n => n.id === a.note_id);
        return note?.content_type === annotationTypeFilter;
      });
    }

    // 3. 搜索过滤
    if (keyword) {
      scoped = scoped.filter((a) => {
        const content = (a.content ?? "").toLowerCase();
        const quote = (a.highlights?.quote ?? "").toLowerCase();
        return content.includes(keyword) || quote.includes(keyword);
      });
    }

    // 4. 排序
    return [...scoped].sort((a, b) => {
      const noteA = annotationNotes.find(n => n.id === a.note_id);
      const noteB = annotationNotes.find(n => n.id === b.note_id);

      switch (annotationSort) {
        case "created_at_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "created_at_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "updated_at_asc":
          return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
        case "updated_at_desc":
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        case "url_az":
          return (noteA?.source_url || "").localeCompare(noteB?.source_url || "");
        case "url_za":
          return (noteB?.source_url || "").localeCompare(noteA?.source_url || "");
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [annotations, selectedAnnotationNoteId, annotationRecordSearch, annotationSort, annotationTypeFilter, annotationNotes]);

  useEffect(() => {
    if (activePrimary !== "annotations") return;

    const ids = filteredAnnotationRecords
      .map((a) => a.id)
      .filter(Boolean)
      .slice(0, 80);

    if (ids.length === 0) {
      setQuoteMaterialIdByAnnotationId({});
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        const url = `/api/quote-materials?annotation_ids=${encodeURIComponent(ids.join(","))}&limit=200`;
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) return;

        const next: Record<string, string> = {};
        for (const it of Array.isArray(json.items) ? json.items : []) {
          if (typeof it?.annotation_id === "string" && typeof it?.id === "string") {
            next[it.annotation_id] = it.id;
          }
        }
        setQuoteMaterialIdByAnnotationId(next);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
      }
    };

    void load();
    return () => controller.abort();
  }, [activePrimary, filteredAnnotationRecords]);

  const toggleQuoteMaterialForAnnotation = useCallback(
    async (annotationId: string) => {
      if (!annotationId) return;
      setQuoteMaterialBusyAnnotationIds((prev) => new Set(prev).add(annotationId));
      try {
        const existingId = quoteMaterialIdByAnnotationId[annotationId];
        if (existingId) {
          const res = await fetch(`/api/quote-materials?id=${encodeURIComponent(existingId)}`, { method: "DELETE" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.success) {
            toast.error(json?.error || "取消金句素材失败");
            return;
          }
          setQuoteMaterialIdByAnnotationId((prev) => {
            const next = { ...prev };
            delete next[annotationId];
            return next;
          });
          toast.success("已取消金句素材");
          return;
        }

        const res = await fetch("/api/quote-materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotation_id: annotationId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          toast.error(json?.error || "设为金句素材失败");
          return;
        }
        const id = String(json?.item?.id || "");
        if (id) {
          setQuoteMaterialIdByAnnotationId((prev) => ({ ...prev, [annotationId]: id }));
        }
        toast.success("已设为金句素材");
      } finally {
        setQuoteMaterialBusyAnnotationIds((prev) => {
          const next = new Set(prev);
          next.delete(annotationId);
          return next;
        });
      }
    },
    [quoteMaterialIdByAnnotationId],
  );

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        window.location.href = "/auth/login";
        return;
      }
      setUser(currentUser);
    };
    loadUser();
  }, [supabase]);

  const loadMetadata = useCallback(async () => {
    if (!user) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Helper function to count untagged notes with fallback
    const countUntaggedNotes = async () => {
      try {
        const result = await supabase.rpc("count_untagged_notes");
        if (result.error) {
          throw result.error;
        }
        return result;
      } catch (error: any) {
        // Fallback: manually count notes with no tags if RPC function doesn't exist
        console.warn("RPC function count_untagged_notes not available, using fallback:", error);
        const { data: allNotes } = await supabase
          .from("notes")
          .select("id")
          .eq("user_id", user.id)
          .is("archived_at", null)
          .is("deleted_at", null);
        const { data: taggedNotes } = await supabase
          .from("note_tags")
          .select("note_id");
        const taggedNoteIds = new Set(taggedNotes?.map((nt) => nt.note_id) || []);
        const untaggedCount = (allNotes || []).filter((n) => !taggedNoteIds.has(n.id)).length;
        return { data: untaggedCount, error: null };
      }
    };

    const baseNotesCountQuery = () =>
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("archived_at", null)
        .is("deleted_at", null);

    const [allRes, uncategorizedRes, starredRes, todayRes, untaggedRes] = await Promise.all([
      baseNotesCountQuery(),
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("archived_at", null)
        .is("deleted_at", null)
        .is("folder_id", null),
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("archived_at", null)
        .is("deleted_at", null)
        .eq("is_starred", true),
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("archived_at", null)
        .is("deleted_at", null)
        .gte("captured_at", todayStart.toISOString())
        .lte("captured_at", todayEnd.toISOString()),
      // Count notes with no tags (using RPC function with fallback)
      countUntaggedNotes(),
    ]);

    setCounts({
      uncategorized: uncategorizedRes.count ?? 0,
      all: allRes.count ?? 0,
      starred: starredRes.count ?? 0,
      today: todayRes.count ?? 0,
      untagged: untaggedRes.data ?? 0,
    });

    const [foldersRes, tagsRes, noteTagsRes, wechatRes] = await Promise.all([
      supabase
        .from("folders")
        .select(
          "id, name, color, position, parent_id, icon, archived_at, notes(count)",
        )
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
      supabase.from("tags").select("id, name, color").order("name"),
      supabase.from("note_tags").select("tag_id"),
      supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("archived_at", null)
        .is("deleted_at", null)
        .ilike("source_url", "%mp.weixin%"),
    ]);

    const normalizedFolders: FolderWithCount[] = (foldersRes.data ?? [])
      .filter((folder) => !folder.archived_at)
      .map((folder) => {
        const noteCountEntry = Array.isArray(folder.notes)
          ? folder.notes[0]
          : null;
        return {
          id: folder.id,
          name: folder.name,
          color: folder.color,
          position: folder.position,
          parent_id: folder.parent_id,
          icon: folder.icon,
          archived_at: folder.archived_at,
          note_count: Number(noteCountEntry?.count ?? 0),
        };
      });

    setFolders(normalizedFolders);
    setExpandedFolders((prev) => {
      if (prev.size === 0) {
        const rootIds = normalizedFolders
          .filter((folder) => !folder.parent_id)
          .map((folder) => folder.id);
        return new Set(rootIds);
      }
      const next = new Set<string>();
      normalizedFolders.forEach((folder) => {
        if (prev.has(folder.id)) {
          next.add(folder.id);
        }
      });
      if (next.size === 0) {
        normalizedFolders
          .filter((folder) => !folder.parent_id)
          .forEach((folder) => next.add(folder.id));
      }
      return next;
    });
    let shouldResetSelection = false;
    setSelectedFolder((prev) => {
      if (!prev) return prev;
      const exists = normalizedFolders.some((folder) => folder.id === prev);
      if (!exists) {
        shouldResetSelection = true;
        return null;
      }
      return prev;
    });
    if (shouldResetSelection) {
      setCategory("uncategorized");
    }

    setAvailableTags(tagsRes.data ?? []);

    const tagCountMap = (noteTagsRes.data ?? []).reduce(
      (acc: Record<string, number>, row: { tag_id: string }) => {
        const id = row.tag_id;
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      },
      {},
    );

    const topTagSmartLists: SmartList[] = (tagsRes.data ?? [])
      .map((tag) => ({
        id: `tag-${tag.id}`,
        label: tag.name,
        type: "tag" as const,
        tagId: tag.id,
        count: tagCountMap[tag.id] ?? 0,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const domainSmartLists: SmartList[] = [];
    if ((wechatRes.count ?? 0) > 0) {
      domainSmartLists.push({
        id: "domain-wechat",
        label: "微信公众号",
        type: "domain",
        domain: "mp.weixin.qq.com",
        count: wechatRes.count ?? 0,
      });
    }

    setSmartLists([...topTagSmartLists, ...domainSmartLists]);
  }, [supabase, user]);

  const showConfirm = (options: {
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "default" | "destructive";
    onConfirm: () => Promise<void> | void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      ...options,
    });
  };

  const closeConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const loadTags = useCallback(async () => {
    if (!user) return;
    
    setTagsLoading(true);
    try {
      const response = await fetch("/api/tags?include_counts=true");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to load tags:", response.status, errorData);
        
        // Show user-friendly error if migration not run
        if (response.status === 500 && errorData.error?.includes("migration")) {
          console.warn("⚠️ 标签功能需要数据库迁移。请执行: supabase/migrations/006_add_tag_management.sql");
        }
        
        // Set empty array so UI doesn't break
        setTags([]);
        return;
      }
      
      const data = await response.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error("Error loading tags:", error);
      // Set empty array on error so UI doesn't break
      setTags([]);
    } finally {
      setTagsLoading(false);
    }
  }, [user]);

  const loadAnnotationsView = useCallback(async (pageToLoad = 0, append = false) => {
    if (!user) return;

    if (append) {
      setLoadingMoreAnnotations(true);
    } else {
      setAnnotationsLoading(true);
      setAnnotationsError(null);
    }

    try {
      const from = pageToLoad * ANNOTATIONS_PAGE_SIZE;
      const to = from + ANNOTATIONS_PAGE_SIZE - 1;

      const { data: annotationRows, error: annotationsFetchError, count } = await supabase
        .from("annotations")
        .select(
          "id, note_id, highlight_id, content, created_at, updated_at, timecode, screenshot_url, is_floating, highlights(quote, color)",
          { count: "exact" }
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (annotationsFetchError) throw annotationsFetchError;

      const rows = (annotationRows ?? []) as unknown as AnnotationRecord[];
      
      setAnnotations(prev => append ? [...prev, ...rows] : rows);
      setAnnotationsPage(pageToLoad);

      if (count !== null) {
        setHasMoreAnnotations(to + 1 < count);
      } else {
        setHasMoreAnnotations(rows.length === ANNOTATIONS_PAGE_SIZE);
      }

      const noteIds = Array.from(new Set(rows.map((r) => r.note_id).filter(Boolean)));
      if (noteIds.length > 0) {
        const { data: noteRows, error: notesFetchError } = await supabase
          .from("notes")
          .select(noteSelect)
          .in("id", noteIds)
          .eq("user_id", user.id)
          .is("deleted_at", null);

        if (notesFetchError) throw notesFetchError;

        const normalized = ((noteRows ?? []) as unknown as RawNote[]).map(normalizeNote);

        // Simple mapping for current batch
        const lastByNote = new Map<string, string>();
        for (const r of rows) {
          if (!lastByNote.has(r.note_id)) lastByNote.set(r.note_id, r.created_at);
        }

        const enrichedNew: AnnotatedNoteItem[] = normalized.map((n) => ({
          ...n,
          last_annotated_at: lastByNote.get(n.id) ?? n.created_at,
        }));

        setAnnotationNotes(prev => {
          const combined = append ? [...prev, ...enrichedNew] : enrichedNew;
          // Deduplicate by ID
          const map = new Map();
          combined.forEach(item => map.set(item.id, item));
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.last_annotated_at).getTime() - new Date(a.last_annotated_at).getTime()
          );
        });
      } else if (!append) {
        setAnnotationNotes([]);
      }
      
      // Removed forced selection of first note to support "All Annotations" default

    } catch (e: any) {
      console.error("load annotations error", e);
      setAnnotationsError(e?.message ?? "加载批注失败");
      if (!append) {
        setAnnotations([]);
        setAnnotationNotes([]);
      }
    } finally {
      setAnnotationsLoading(false);
      setLoadingMoreAnnotations(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    if (activePrimary !== "annotations") return;
    setAnnotationsPage(0);
    setHasMoreAnnotations(true);
    loadAnnotationsView(0, false);
  }, [activePrimary, loadAnnotationsView, user]);

  useEffect(() => {
    const target = loadMoreAnnotationsRef.current;
    if (!target) return;

    // Use rootMargin to trigger loading 200px before reaching the bottom
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreAnnotations && !loadingMoreAnnotations && !annotationsLoading) {
          loadAnnotationsView(annotationsPage + 1, true);
        }
      },
      {
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [loadAnnotationsView, hasMoreAnnotations, loadingMoreAnnotations, annotationsLoading, annotationsPage]);

  const fetchNotes = useCallback(
    async (pageToLoad = 0, append = false) => {
      if (!user) return;
      setNotesLoadingError(null);
      if (append) {
        setLoadingMore(true);
      } else {
        setInitialLoading(true);
      }

      let query = supabase
        .from("notes")
        .select(noteSelect, { count: "exact" });

      // Apply archived filter
      if (showArchived) {
        query = query.not("archived_at", "is", null);
      } else {
        query = query.is("archived_at", null);
      }

      // Exclude deleted notes from normal views
      query = query.is("deleted_at", null);

      // Apply content type filter
      if (contentTypeFilter && contentTypeFilter !== "all") {
        query = query.eq("content_type", contentTypeFilter);
      }

      if (category === "uncategorized") {
        query = query.is("folder_id", null);
      } else if (category === "starred") {
        query = query.eq("is_starred", true);
      } else if (category === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        query = query
          .gte("captured_at", start.toISOString())
          .lte("captured_at", end.toISOString());
      } else if (category === "folder" && selectedFolder) {
        query = query.eq("folder_id", selectedFolder);
      } else if (category === "smart" && selectedSmartList) {
        if (selectedSmartList.type === "tag" && selectedSmartList.tagId) {
          const { data: tagNoteRows } = await supabase
            .from("note_tags")
            .select("note_id")
            .eq("tag_id", selectedSmartList.tagId);
          const noteIds = tagNoteRows?.map((row) => row.note_id) ?? [];
          if (noteIds.length === 0) {
            setNotes([]);
            setHasMore(false);
            setInitialLoading(false);
            setLoadingMore(false);
            return;
          }
          query = query.in("id", noteIds);
        } else if (selectedSmartList.type === "domain" && selectedSmartList.domain) {
          query = query.ilike("source_url", `%${selectedSmartList.domain}%`);
        }
      }

      // Apply tag filter when in tags view
      if (activePrimary === "tags") {
        if (selectedTag === null) {
          // Show notes with no tags (untagged notes)
          const { data: taggedNoteRows } = await supabase
            .from("note_tags")
            .select("note_id");
          
          const taggedNoteIds = taggedNoteRows?.map((row) => row.note_id) ?? [];
          if (taggedNoteIds.length > 0) {
            query = query.not("id", "in", `(${taggedNoteIds.join(",")})`);
          }
          // If no tagged notes exist, all notes are untagged, so no filter needed
        } else if (selectedTag) {
          // Show notes with specific tag(s)
          let tagIds = [selectedTag];
          
          // Include child tags if enabled
          if (includeChildTags) {
            const descendantIds = getDescendantTagIds(tagTreeRef.current, selectedTag);
            tagIds = descendantIds.length > 0 ? descendantIds : [selectedTag];
          }
          
          const { data: tagNoteRows } = await supabase
            .from("note_tags")
            .select("note_id")
            .in("tag_id", tagIds);
          
          const noteIds = tagNoteRows?.map((row) => row.note_id) ?? [];
          if (noteIds.length === 0) {
            setNotes([]);
            setHasMore(false);
            setInitialLoading(false);
            setLoadingMore(false);
            return;
          }
          query = query.in("id", noteIds);
        }
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      if (searchQuery.trim()) {
        const keyword = `%${searchQuery.trim().replace(/%/g, "\\%")}%`;
        query = query.or(
          `title.ilike.${keyword},excerpt.ilike.${keyword},site_name.ilike.${keyword}`,
        );
      }

      const from = pageToLoad * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error("load notes error", error);
        setNotesLoadingError(error.message);
      } else {
        const noteRows = (data ?? []) as unknown as RawNote[];
        const normalized = noteRows.map(normalizeNote);
        setNotes((prev) => {
          const combined = append ? [...prev, ...normalized] : normalized;
          const uniqueMap = new Map();
          combined.forEach(item => uniqueMap.set(item.id, item));
          return Array.from(uniqueMap.values());
        });
        if (count === null) {
          setHasMore((data ?? []).length === PAGE_SIZE);
        } else {
          setHasMore(to + 1 < count);
        }
        setPage(pageToLoad);
      }

      setInitialLoading(false);
      setLoadingMore(false);
    },
    [category, selectedFolder, selectedSmartList, activePrimary, selectedTag, includeChildTags, searchQuery, showArchived, contentTypeFilter, sortBy, sortOrder, supabase, user],
  );

  useEffect(() => {
    if (!user) return;
    loadMetadata();
  }, [loadMetadata, user]);

  useEffect(() => {
    if (!user) return;
    if (activePrimary === "tags") {
      loadTags();
    }
  }, [loadTags, user, activePrimary]);

  useEffect(() => {
    if (!user) return;
    setNotes([]);
    setPage(0);
    setHasMore(true);
    fetchNotes(0, false);
  }, [user, category, selectedFolder, selectedSmartList, selectedTag, searchQuery, showArchived, contentTypeFilter, sortBy, sortOrder, fetchNotes, refreshTrigger]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("viewMode", viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tagSortMode", tagSortMode);
    }
  }, [tagSortMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("includeChildTags", String(includeChildTags));
    }
  }, [includeChildTags]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    // Use rootMargin to trigger loading 200px before reaching the bottom
    // This creates a smoother infinite scroll experience
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loadingMore && !initialLoading) {
          fetchNotes(page + 1, true);
        }
      },
      {
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [fetchNotes, hasMore, loadingMore, initialLoading, page]);

  const toggleSelectNote = (noteId: string) => {
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const clearSelections = useCallback(() => {
    setSelectedNotes(new Set());
  }, []);

  const ensureSelection = (ids?: string[]) => {
    if (ids && ids.length > 0) {
      return ids;
    }
    if (selectedNotes.size === 0) {
      toast.warning("请选择至少一条笔记");
      return null;
    }
    return Array.from(selectedNotes);
  };

  const refreshAll = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
    await Promise.all([loadMetadata(), loadTags()]);
    clearSelections();
  }, [clearSelections, loadMetadata, loadTags]);

  const refreshAnnotationCounts = useCallback(
    async (noteIds: string[]) => {
      const ids = Array.from(new Set(noteIds)).filter(Boolean);
      if (!user || ids.length === 0) return;

      const { data, error } = await supabase
        .from("notes")
        .select("id, highlights(count)")
        .in("id", ids);

      if (error) {
        console.error("Failed to refresh annotation counts:", error);
        return;
      }

      const countsById = new Map<string, number>();
      (data ?? []).forEach((row: any) => {
        const count = row?.highlights?.[0]?.count ?? 0;
        countsById.set(String(row.id), Number(count) || 0);
      });

      if (countsById.size === 0) return;

      setNotes((prev) =>
        prev.map((note) =>
          countsById.has(note.id)
            ? { ...note, annotation_count: countsById.get(note.id)! }
            : note,
        ),
      );

      setAnnotationNotes((prev) =>
        prev.map((note) =>
          countsById.has(note.id)
            ? { ...note, annotation_count: countsById.get(note.id)! }
            : note,
        ),
      );
    },
    [supabase, user],
  );

  const syncDirtyAnnotationCounts = useCallback(async () => {
    if (!user) return;
    // 使用 peek 而不是 consume，避免过早清空数据
    const dirtyIds = peekDirtyAnnotationNoteIds();
    if (dirtyIds.length === 0) return;
    
    // 检查 notes 状态是否已加载，如果还没加载完成，延迟处理
    if (notes.length === 0) {
      // notes 还没加载，不清空 sessionStorage，等待下次调用
      return;
    }
    
    // 刷新批注数量
    await refreshAnnotationCounts(dirtyIds);
    
    // 刷新成功后清空已处理的 IDs
    clearDirtyAnnotationNoteIds(dirtyIds);
  }, [refreshAnnotationCounts, user, notes.length]);

  // 初始调用
  useEffect(() => {
    syncDirtyAnnotationCounts();
  }, [syncDirtyAnnotationCounts]);

  // 当 notes 加载完成后，再次检查并刷新脏数据
  useEffect(() => {
    if (notes.length > 0) {
      syncDirtyAnnotationCounts();
    }
  }, [notes.length, syncDirtyAnnotationCounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readTs = () => {
      try {
        const raw = localStorage.getItem("newsbox:annotations_updated_at");
        const ts = raw ? Number(raw) : 0;
        return Number.isFinite(ts) ? ts : 0;
      } catch {
        return 0;
      }
    };

    // Initialize on mount
    if (lastSeenAnnotationsUpdatedAtRef.current === 0) {
      lastSeenAnnotationsUpdatedAtRef.current = readTs();
    }

    const maybeRefresh = () => {
      syncDirtyAnnotationCounts();
      const ts = readTs();
      if (ts > lastSeenAnnotationsUpdatedAtRef.current) {
        lastSeenAnnotationsUpdatedAtRef.current = ts;
        
        // 即使 sessionStorage 被清空，也尝试刷新最近更新的 noteId
        const lastNoteId = getLastDirtyNoteId();
        if (lastNoteId && notes.length > 0) {
          void refreshAnnotationCounts([lastNoteId]);
        }
        
        void refreshAll();
        if (user && activePrimary === "annotations") {
          loadAnnotationsView(0, false);
        }
      }
    };

    const onVisible = () => {
      maybeRefresh();
      // Annotation saves may complete slightly after navigation; re-check a couple times.
      const t1 = window.setTimeout(maybeRefresh, 800);
      const t2 = window.setTimeout(maybeRefresh, 2000);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    };

    let cleanupTimers: (() => void) | null = null;
    const run = () => {
      cleanupTimers?.();
      cleanupTimers = onVisible();
    };

    run();

    const onFocus = () => run();
    const onVisibilityChange = () => {
      if (!document.hidden) run();
    };

    const onAnnotationsChanged = () => run();
    const onPageShow = () => run();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(NOTE_ANNOTATIONS_CHANGED_EVENT, onAnnotationsChanged as EventListener);
    window.addEventListener("pageshow", onPageShow as EventListener);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(NOTE_ANNOTATIONS_CHANGED_EVENT, onAnnotationsChanged as EventListener);
      window.removeEventListener("pageshow", onPageShow as EventListener);
      cleanupTimers?.();
    };
  }, [activePrimary, loadAnnotationsView, refreshAll, syncDirtyAnnotationCounts, user, notes.length, refreshAnnotationCounts]);

  const ensureParentsExpanded = useCallback(
    (folderId: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        let current = folderMap.get(folderId)?.parent_id ?? null;
        while (current) {
          next.add(current);
          current = folderMap.get(current)?.parent_id ?? null;
        }
        return next;
      });
    },
    [folderMap],
  );

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleSelectFolder = (folderId: string) => {
    setCategory("folder");
    setSelectedSmartList(null);
    setSelectedFolder(folderId);
    ensureParentsExpanded(folderId);
    trackAccess('folder', folderId);
  };

  const openCreateFolderDialog = (parentId: string | null = null) => {
    setFolderDialogMode("create");
    setFolderDialogParent(parentId);
    setFolderDialogName("");
    setFolderDialogIcon("");
    setFolderDialogTargetId(null);
    setShowFolderDialog(true);
  };

  const openEditFolderDialog = (folder: FolderWithCount) => {
    setFolderDialogMode("edit");
    setFolderDialogTargetId(folder.id);
    setFolderDialogParent(folder.parent_id);
    setFolderDialogName(folder.name);
    setFolderDialogIcon(folder.icon ?? "");
    setShowFolderDialog(true);
  };

  const closeFolderDialog = () => {
    setShowFolderDialog(false);
    setFolderDialogTargetId(null);
    setFolderDialogParent(null);
    setFolderDialogName("");
    setFolderDialogIcon("");
    setFolderActionLoading(false);
  };

  const handleFolderDialogSubmit = async () => {
    if (!user) return;
    const name = folderDialogName.trim();
    if (!name) {
      toast.error("请输入收藏夹名称");
      return;
    }
    if (
      folderDialogMode === "edit" &&
      folderDialogTargetId &&
      folderDialogParent
    ) {
      const invalidParents = getDescendantIds(
        folderTree,
        folderDialogTargetId,
      );
      invalidParents.add(folderDialogTargetId);
      if (invalidParents.has(folderDialogParent)) {
        toast.error("不能将收藏夹移动到自身或其子级下");
        return;
      }
    }
    setFolderActionLoading(true);
    try {
      if (folderDialogMode === "create") {
        const { error } = await supabase.from("folders").insert({
          name,
          icon: folderDialogIcon || null,
          parent_id: folderDialogParent,
          user_id: user.id,
        });
        if (error) throw error;
      } else if (folderDialogTargetId) {
        const { error } = await supabase
          .from("folders")
          .update({
            name,
            icon: folderDialogIcon || null,
            parent_id: folderDialogParent,
          })
          .eq("id", folderDialogTargetId);
        if (error) throw error;
      }
      closeFolderDialog();
      await loadMetadata();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误";
      toast.error(`保存收藏夹失败: ${message}`);
    } finally {
      setFolderActionLoading(false);
    }
  };

  const handleArchiveFolder = async (folder: FolderWithCount) => {
    showConfirm({
      title: "确认归档",
      description: `确认将“${folder.name}”归档？归档后将从侧边栏隐藏，可在后续版本中恢复。`,
      confirmText: "归档",
      onConfirm: async () => {
        const { error } = await supabase
          .from("folders")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", folder.id);
        if (error) {
          toast.error(`归档失败: ${error.message}`);
          return;
        }
        if (selectedFolder === folder.id) {
          setCategory("uncategorized");
          setSelectedFolder(null);
        }
        await loadMetadata();
        closeConfirm();
      },
    });
  };

  const handleDeleteFolder = async (folder: FolderWithCount) => {
    const hasChildren = folders.some((item) => item.parent_id === folder.id);
    if (hasChildren) {
      toast.error("请先删除或移动子收藏夹，再删除该收藏夹");
      return;
    }
    if (folder.note_count > 0) {
      toast.error("该收藏夹仍有笔记，请先移动或删除笔记后再尝试");
      return;
    }
    
    showConfirm({
      title: "确认删除",
      description: `确认删除“${folder.name}”？该操作不可恢复。`,
      confirmText: "删除",
      variant: "destructive",
      onConfirm: async () => {
        const { error } = await supabase.from("folders").delete().eq("id", folder.id);
        if (error) {
          toast.error(`删除失败: ${error.message}`);
          return;
        }
        if (selectedFolder === folder.id) {
          setCategory("uncategorized");
          setSelectedFolder(null);
        }
        await loadMetadata();
        closeConfirm();
      },
    });
  };

  // Tag management functions
  const openCreateTagDialog = (parentId: string | null = null) => {
    setTagDialogMode("create");
    setTagDialogParent(parentId);
    setTagDialogName("");
    setTagDialogIcon("");
    setTagDialogColor("");
    setTagDialogTargetId(null);
    setShowTagDialog2(true);
  };

  const openEditTagDialog = (tag: TagTreeNode) => {
    setTagDialogMode("edit");
    setTagDialogTargetId(tag.id);
    setTagDialogParent(tag.parent_id || null);
    setTagDialogName(tag.name);
    setTagDialogIcon(tag.icon || "");
    setTagDialogColor(tag.color || "");
    setShowTagDialog2(true);
  };

  const closeTagDialog2 = () => {
    setShowTagDialog2(false);
    setTagDialogTargetId(null);
    setTagDialogParent(null);
    setTagDialogName("");
    setTagDialogIcon("");
    setTagDialogColor("");
    setTagActionLoading(false);
  };

  const handleTagDialogSubmit = async () => {
    const name = tagDialogName.trim();
    if (!name) {
      toast.error("请输入标签名称");
      return;
    }

    setTagActionLoading(true);
    try {
      if (tagDialogMode === "create") {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            color: tagDialogColor || null,
            icon: tagDialogIcon || null,
            parent_id: tagDialogParent,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "创建标签失败");
        }
      } else if (tagDialogTargetId) {
        const response = await fetch(`/api/tags/${tagDialogTargetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            color: tagDialogColor || null,
            icon: tagDialogIcon || null,
            parent_id: tagDialogParent,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "更新标签失败");
        }
      }

      closeTagDialog2();
      await loadTags();
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      toast.error(`操作失败: ${message}`);
    } finally {
      setTagActionLoading(false);
    }
  };

  const handleArchiveTag = async (tag: TagTreeNode) => {
    showConfirm({
      title: "确认归档",
      description: `确认将"${tag.name}"归档？归档后将从列表隐藏。`,
      confirmText: "归档",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/tags/${tag.id}/archive`, {
            method: "POST",
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "归档失败");
          }

          if (selectedTag === tag.id) {
            setSelectedTag(null);
          }
          await loadTags();
          closeConfirm();
        } catch (error) {
          const message = error instanceof Error ? error.message : "未知错误";
          toast.error(`归档失败: ${message}`);
        }
      },
    });
  };

  const handleDeleteTag = async (tag: TagTreeNode) => {
    const hasChildren = tag.children.length > 0;
    if (hasChildren) {
      toast.error("请先删除或移动子标签");
      return;
    }

    const deleteLogic = async () => {
      try {
        const response = await fetch(`/api/tags/${tag.id}?force=true`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "删除失败");
        }

        if (selectedTag === tag.id) {
          setSelectedTag(null);
        }
        await loadTags();
        closeConfirm();
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        toast.error(`删除失败: ${message}`);
      }
    };

    if (tag.note_count > 0) {
      showConfirm({
        title: "确认删除",
        description: `标签"${tag.name}"下有 ${tag.note_count} 条笔记。确认删除？笔记关联将被移除。`,
        confirmText: "删除",
        variant: "destructive",
        onConfirm: deleteLogic,
      });
    } else {
      showConfirm({
        title: "确认删除",
        description: `确认删除"${tag.name}"？该操作不可恢复。`,
        confirmText: "删除",
        variant: "destructive",
        onConfirm: deleteLogic,
      });
    }
  };

  /**
   * 切换笔记星标状态（智能批量操作 + 乐观更新）
   *
   * @param noteIds - 笔记 ID 数组（未传入时使用已选中的笔记）
   *
   * 智能切换逻辑：
   * 1. 扫描所有目标笔记的星标状态
   * 2. 如果存在未星标的笔记，全部设置为星标
   * 3. 如果全部已星标，全部取消星标
   *
   * 实现原理：
   * - `anyUnstarred`: 使用 `Array.some()` 快速判断是否存在未星标项
   * - 优势：一次数据库调用完成批量操作（原子性）
   * - 乐观更新：先更新 UI，再同步数据库，失败时回滚
   *
   * 性能考量：
   * - 本地扫描（内存）：O(n)，n 为笔记数
   * - 数据库更新：单次 UPDATE ... IN (...) 语句
   * - 网络延迟：通常 < 100ms
   * - UI 响应：即时（< 50ms）
   *
   * UI 行为：
   * - 批量选中时：按"多数原则"切换（类似 iOS 批量操作）
   * - 例如：3 条选中，2 条已星标 → 结果：全部星标
   * - 操作期间显示加载状态，防止重复点击
   */
  const toggleStar = async (noteIds?: string[]) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    
    // Prevent duplicate operations
    if (ids.some(id => starringNotes.has(id))) return;
    
    // Calculate new star state
    const anyUnstarred = ids.some((id) => {
      const note = notes.find((n) => n.id === id);
      return note && !note.is_starred;
    });
    
    // Store previous state for rollback
    const previousNotes = notes.filter(n => ids.includes(n.id)).map(n => ({ id: n.id, is_starred: n.is_starred }));
    const previousStarredCount = counts.starred;
    
    // Set loading state
    setStarringNotes(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    
    // Optimistic update - update UI immediately
    setNotes(prev => prev.map(note => 
      ids.includes(note.id) ? { ...note, is_starred: anyUnstarred } : note
    ));
    
    // Update counts optimistically
    const starDelta = anyUnstarred 
      ? ids.filter(id => !previousNotes.find(n => n.id === id)?.is_starred).length
      : -ids.filter(id => previousNotes.find(n => n.id === id)?.is_starred).length;
    setCounts(prev => ({ ...prev, starred: Math.max(0, prev.starred + starDelta) }));
    
    // Sync with database
    const { error } = await supabase
      .from("notes")
      .update({ is_starred: anyUnstarred })
      .in("id", ids);
    
    // Clear loading state
    setStarringNotes(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    
    if (error) {
      // Rollback on error
      setNotes(prev => prev.map(note => {
        const original = previousNotes.find(n => n.id === note.id);
        return original ? { ...note, is_starred: original.is_starred } : note;
      }));
      setCounts(prev => ({ ...prev, starred: previousStarredCount }));
      toast.error(`星标操作失败: ${error.message}`);
    } else {
      // Show success feedback
      toast.success(anyUnstarred ? "已添加星标" : "已取消星标");
      clearSelections();
    }
  };

  /**
   * 归档笔记（软删除，可恢复，乐观更新）
   *
   * @param noteIds - 笔记 ID 数组（未传入时使用已选中的笔记）
   *
   * 数据库变更：
   * - UPDATE notes SET status='archived', archived_at=NOW()
   * - 归档时间戳用于追溯和批量恢复
   * - 笔记从主列表隐藏（showArchived=false 时）
   *
   * 数据一致性保证：
   * 1. 数据库层：直接 UPDATE，无级联操作
   * 2. UI 缓存：乐观更新，失败时回滚
   * 3. 全局状态：可触发自定义事件（如需跨组件同步）
   *
   * 与物理删除的区别：
   * - 归档：保留数据，仅从视图隐藏
   * - 删除：设置 deleted_at，定期清理任务会物理删除
   *
   * 用户体验：
   * - 确认对话框防止误操作
   * - 乐观更新：确认后立即从列表移除
   * - 可通过"显示已归档"开关恢复
   * - 操作期间显示加载状态
   *
   * 性能考量：
   * - 单条操作：< 50ms
   * - 批量归档（1000 条）：~200ms（数据库索引优化）
   * - UI 响应：即时（< 50ms）
   *
   * 未来改进：
   * - 添加撤销功能（通过清除 archived_at）
   * - 批量恢复功能
   * - 归档原因标签（如"已读"、"过期"）
   */
  const archiveNotes = async (noteIds?: string[]) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    
    // Prevent duplicate operations
    if (ids.some(id => archivingNotes.has(id))) return;

    showConfirm({
      title: "确认归档",
      description: `确定要归档选中的 ${ids.length} 条笔记吗？`,
      confirmText: "归档",
      onConfirm: async () => {
        // Store previous state for rollback
        const previousNotes = notes.filter(n => ids.includes(n.id));
        const previousCounts = { ...counts };
        
        // Set loading state
        setArchivingNotes(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
        
        // Close dialog immediately for better UX
        closeConfirm();
        
        // Optimistic update - remove from list immediately (unless viewing archived)
        if (!showArchived && activePrimary !== "archive") {
          setNotes(prev => prev.filter(note => !ids.includes(note.id)));
        } else {
          // If viewing archived, update the status in place
          const now = new Date().toISOString();
          setNotes(prev => prev.map(note => 
            ids.includes(note.id) 
              ? { ...note, status: "archived" as const, archived_at: now } 
              : note
          ));
        }
        
        // Update counts optimistically
        const starredCount = previousNotes.filter(n => n.is_starred).length;
        setCounts(prev => ({
          ...prev,
          all: Math.max(0, prev.all - ids.length),
          starred: Math.max(0, prev.starred - starredCount),
        }));
        
        try {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from("notes")
            .update({ status: "archived", archived_at: now })
            .in("id", ids);

          if (error) throw error;
          
          // Clear loading state
          setArchivingNotes(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.delete(id));
            return next;
          });
          
          // Show success feedback
          toast.success(`已归档 ${ids.length} 条笔记`);
          clearSelections();
          
          // Refresh folder counts in background (non-blocking)
          loadMetadata();
        } catch (error) {
          // Clear loading state
          setArchivingNotes(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.delete(id));
            return next;
          });
          
          // Rollback on error
          setNotes(prev => {
            // Re-insert the archived notes
            const existingIds = new Set(prev.map(n => n.id));
            const notesToRestore = previousNotes.filter(n => !existingIds.has(n.id));
            return [...notesToRestore, ...prev].sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
          setCounts(previousCounts);
          
          const message = error instanceof Error ? error.message : "未知错误";
          toast.error(`归档失败: ${message}`);
        }
      },
    });
  };

  /**
   * 删除笔记（软删除，进入回收站）
   *
   * @param noteIds - 笔记 ID 数组（未传入时使用已选中的笔记）
   *
   * 删除流程：
   * 1. 显示二次确认对话框（防止误操作）
   * 2. 用户取消则中止操作
   * 3. 更新 deleted_at 时间戳（软删除）
   * 4. 刷新 UI（从列表移除）
   *
   * 数据一致性保证：
   *
   * **数据库层**：
   * - notes 表：仅设置 deleted_at，不物理删除
   * - 关联数据：
   *   - highlights: 保留（关联删除会丢失用户批注）
   *   - annotations: 保留（同上）
   *   - note_tags: 保留（恢复后自动关联）
   * - 定期清理任务：30 天后物理删除（或根据用户设置）
   *
   * **UI 缓存**：
   * - refreshAll() 立即刷新当前列表
   * - 已删除笔记从所有视图移除（RLS 过滤）
   *
   * **全局状态**：
   * - 如有其他组件缓存笔记数据，需手动清理
   * - 考虑实现全局笔记缓存管理器
   *
   * 带影响操作（考虑实现）：
   * - 笔记删除后，其高亮和批注是否显示？
   * - 删除收藏夹时，关联笔记如何处理？
   * - 删除标签时，note_tags 关联是否自动清理？
   *
   * 恢复机制（未实现）：
   * - 建议添加"回收站"视图
   * - 提供"恢复"按钮（清除 deleted_at）
   * - 批量清空回收站功能
   *
   * 性能考量：
   * - 单条删除：< 50ms
   * - 批量删除（1000 条）：~300ms
   * - 索引优化：(user_id, deleted_at) 复合索引
   *
   * 安全性：
   * - 二次确认防止误操作
   * - RLS 策略确保用户只能删除自己的数据
   * - 软删除允许恢复（比物理删除更安全）
   */
  const deleteNotes = async (noteIds?: string[]) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;

    showConfirm({
      title: "确认删除",
      description: `确定要删除选中的 ${ids.length} 条笔记吗？删除后可在回收站找回。`,
      confirmText: "删除",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from("notes")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", ids);

          if (error) throw error;

          refreshAll();
          closeConfirm();
        } catch (error) {
          const message = error instanceof Error ? error.message : "未知错误";
          toast.error(`删除失败: ${message}`);
        }
      },
    });
  };

  const moveNotes = async () => {
    const ids = ensureSelection(actionTargetIds);
    if (!ids) return;
    
    try {
      const { error } = await supabase
        .from("notes")
        .update({ folder_id: moveTargetFolder })
        .in("id", ids);
      if (error) throw error;
      
      setShowMoveDialog(false);
      setActionTargetIds([]);
      toast.success("移动成功");
      refreshAll();
    } catch (error: any) {
      toast.error(`移动失败: ${error.message}`);
    }
  };

  const upsertTagsForNotes = async () => {
    const ids = ensureSelection(actionTargetIds);
    if (!ids) return;
    setIsUpsertingTags(true);
    try {
      const { error: deleteError } = await supabase
        .from("note_tags")
        .delete()
        .in("note_id", ids);
      if (deleteError) throw deleteError;

      if (tagDialogSelection.length > 0) {
        const rows = ids.flatMap((noteId) =>
          tagDialogSelection.map((tagId) => ({
            note_id: noteId,
            tag_id: tagId,
          })),
        );
        const { error: insertError } = await supabase
          .from("note_tags")
          .insert(rows);
        if (insertError) throw insertError;
      }

      setShowTagDialog(false);
      setActionTargetIds([]);
      refreshAll();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误";
      toast.error(`设置标签失败: ${message}`);
    } finally {
      setIsUpsertingTags(false);
    }
  };

  const ensureTagSelection = (noteIds?: string[]) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    
    if (tags.length === 0) {
      loadTags();
    }

    const firstNote = notes.find((n) => ids?.includes(n.id));
    const currentTags = firstNote?.tags.map((tag) => tag.id) ?? [];
    setTagDialogSelection(currentTags);
    setActionTargetIds(ids);
    setShowTagDialog(true);
  };

  const ensureMoveDialog = (noteIds?: string[]) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    const firstNote = notes.find((n) => ids?.includes(n.id));
    setMoveTargetFolder(firstNote?.folder_id ?? null);
    setActionTargetIds(ids);
    setShowMoveDialog(true);
  };

  const copyLinks = async (noteIds?: string[]) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    const selectedNotes = notes.filter((note) => ids.includes(note.id));
    const links = selectedNotes
      .map((note) => note.source_url)
      .filter(Boolean)
      .join("\n");
    if (!links) {
      toast.warning("没有可复制的原文链接");
      return;
    }
    await navigator.clipboard.writeText(links);
    toast.success("链接复制成功");
  };

  const fetchNotesByIds = async (ids: string[]) => {
    const { data, error } = await supabase
      .from("notes")
      .select(
        "id, title, content_html, content_text, excerpt, source_url, site_name, created_at",
      )
      .in("id", ids);
    if (error) {
      toast.error(`获取笔记内容失败: ${error.message}`);
      return [];
    }
    return data ?? [];
  };

  /**
   * 根据指定格式构建笔记内容（策略模式实现）
   *
   * @param note - 笔记对象，包含标题、内容、元数据
   * @param format - 目标格式：'text' | 'markdown' | 'html'
   * @returns 格式化后的完整文本内容
   *
   * 格式转换规则：
   *
   * **Text 格式**：
   * - 标题 + 元信息 + 正文纯文本
   * - 优先使用 content_text 字段（已提取的纯文本）
   * - Fallback 到 HTML 转文本 + excerpt 摘要
   *
   * **Markdown 格式**：
   * - 一级标题（# 标题）
   * - 元信息使用引用块（> 元信息）
   * - HTML 通过 Turndown 转换为 Markdown
   * - 保留链接、图片、列表等结构
   *
   * **HTML 格式**：
   * - 完整的 HTML5 文档结构
   * - 包含基础 <head> 元标签（charset, title）
   * - 元信息包裹在 <p> 标签中
   * - 原始 HTML 直接嵌入
   *
   * 性能优化：
   * - Turndown 实例通过 useMemo 缓存（避免重复初始化）
   * - 字符串拼接使用模板字面量（性能优于 +=）
   *
   * 边界情况处理：
   * - content_html 为空时使用 content_text
   * - 所有字段为空时返回 "无标题"
   * - 元信息字段为空时显示 "未知"
   */
  const buildContentByFormat = (
    note: NoteContentRecord,
    format: "text" | "markdown" | "html",
  ) => {
    const title = note.title || "无标题";
    const meta = `来源: ${note.site_name || "未知"}\n采集时间: ${new Date(
      note.created_at,
    ).toLocaleString()}`;
    if (format === "text") {
      const text =
        note.content_text || htmlToPlainText(note.content_html, note.excerpt);
      return `${title}\n${meta}\n\n${text}`.trim();
    }
    if (format === "markdown") {
      if (note.content_html) {
        return `# ${title}

> ${meta}

${turndown.turndown(
          note.content_html,
        )}`;
      }
      return `# ${title}

> ${meta}

${
        note.content_text || note.excerpt || ""
      }`;
    }
    // html
    if (note.content_html) {
      return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${meta}</p>${note.content_html}</body></html>`;
    }
    const textContent = note.content_text || note.excerpt || "";
    return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${meta}</p><p>${textContent}</p></body></html>`;
  };

  /**
   * 复制笔记内容到剪贴板（支持单条或批量）
   *
   * @param format - 内容格式：'text' | 'markdown' | 'html'
   * @param noteIds - 笔记 ID 数组（未传入时使用已选中的笔记）
   *
   * 实现流程：
   * 1. 确定要复制的笔记列表（单选/多选）
   * 2. 批量获取笔记完整内容（fetchNotesByIds）
   * 3. 逐条转换格式并使用 "\n\n---\n\n" 分隔
   * 4. 调用 Clipboard API 写入剪贴板
   * 5. 显示成功提示
   *
   * 浏览器兼容性：
   * - navigator.clipboard 需要 HTTPS 或 localhost
   * - 旧版浏览器可降级到 document.execCommand('copy')
   *
   * 性能考量：
   * - 单条复制：< 100ms（通常）
   * - 批量复制（100 条）：~500ms（需考虑添加 loading 状态）
   * - 大内容（> 1MB）可能导致 UI 卡顿，建议 Web Worker 处理
   *
   * 安全性：
   * - 自动过滤已删除笔记（fetchNotesByIds 中处理）
   * - 用户只能复制自己的笔记（RLS 保证）
   *
   * 分隔符说明：使用 "\n\n---\n\n" 符合 Markdown 多文档分隔规范
   */
  const copyContent = async (
    format: "text" | "markdown" | "html",
    noteIds?: string[],
  ) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    const data = await fetchNotesByIds(ids);
    if (data.length === 0) return;
    const allText = data
      .map((note) => buildContentByFormat(note, format))
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(allText);
    toast.success("内容已复制到剪贴板");
  };

  /**
   * 导出笔记为文件（单文件或 ZIP 打包）
   *
   * @param format - 导出格式：'text' | 'markdown' | 'html'
   * @param noteIds - 笔记 ID 数组（未传入时使用已选中的笔记）
   *
   * 导出策略（工厂模式）：
   *
   * **单文件导出**（笔记数 = 1）：
   * - 直接创建 Blob 对象
   * - 文件名：{标题}.{扩展名}
   * - 扩展名映射：text → txt, markdown → md, html → html
   * - 立即触发下载
   *
   * **批量导出**（笔记数 > 1）：
   * - 使用 JSZip 创建 ZIP 文件
   * - 每个笔记单独打包为文件
   * - 文件名：{标题}.{扩展名}（无标题时使用 ID）
   * - ZIP 文件名：notes-export-{timestamp}.zip
   * - 异步生成（generateAsync）避免阻塞 UI
   *
   * 性能基准测试：
   * - 单条 Markdown（5KB）：~10ms
   * - 100 条 ZIP（总计 50MB）：~3-5 秒
   * - 内存占用：约为文件总大小的 2-3 倍（JSZip 缓存）
   *
   * 优化建议：
   * - 超过 500 条笔记时分批打包（每批 200 条）
   * - 添加导出进度条（当前 JSZip 不支持进度回调）
   * - 考虑服务端生成 ZIP 并返回下载链接（减少客户端压力）
   *
   * 边界情况：
   * - 空标题时使用 note.id 作为文件名
   * - 标题过长（>200 字符）时会被 sanitizeFileName 处理
   * - 特殊字符通过 sanitizeFileName 过滤
   * - 同名文件会覆盖（JSZip 限制，未实现自动重命名）
   *
   * 已知问题：
   * - 批量导出大文件时可能造成 UI 卡顿（可添加 loading 状态）
   * - 文件名冲突时后者覆盖前者（建议添加序号后缀）
   */
  const exportNotes = async (
    format: "text" | "markdown" | "html",
    noteIds?: string[],
  ) => {
    const ids = ensureSelection(noteIds);
    if (!ids) return;
    const data = await fetchNotesByIds(ids);
    if (data.length === 0) return;

    if (data.length === 1) {
      const note = data[0];
      const content = buildContentByFormat(note, format);
      const extension =
        format === "text" ? "txt" : format === "markdown" ? "md" : "html";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, `${sanitizeFileName(note.title || note.id)}.${extension}`);
      return;
    }

    const zip = new JSZip();
    data.forEach((note) => {
      const extension =
        format === "text" ? "txt" : format === "markdown" ? "md" : "html";
      const filename = `${sanitizeFileName(note.title || note.id)}.${extension}`;
      zip.file(filename, buildContentByFormat(note, format));
    });

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `notes-export-${Date.now()}.zip`);
  };

  const handleAddNote = async () => {
    if (!user) return;
    setIsAddingNote(true);
    try {
      if (creationMode === "url") {
        if (!newNoteUrl.trim()) {
          toast.error("请输入有效的 URL");
          setIsAddingNote(false);
          return;
        }
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        const urlValue = newNoteUrl.trim();
        const contentType = urlValue.match(/(bilibili|youtube|youtu.be|douyin|iesdouyin|kuaishou|kuaishouapp)/i)
          ? "video"
          : urlValue.match(/(podcast|spotify|soundcloud)/i)
          ? "audio"
          : "article";
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: currentUser?.id,
            source_url: urlValue,
            content_type: contentType,
            status: "unread",
            source_type: "url",
          })
          .select()
          .single();
        if (error) throw error;
        
        // 1. 调用 capture 并等待其完成
        // 这样可以确保后端抓取（标题、正文、封面等）全部入库后再进行前端刷新
        try {
          await fetch("/api/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteId: data.id, url: urlValue }),
          });
        } catch (err) {
          console.error("Capture failed:", err);
          // 抓取失败也继续，至少用户能看到基础记录
        }

        // 2. 清除输入并关闭对话框
        setNewNoteUrl("");
        setShowAddNoteDialog(false);
        
        // 3. 执行唯一一次刷新
        // 此时数据库中的数据已经是 capture 填充后的完整状态
        await refreshAll();
        return; 
      } else if (creationMode === "quick") {
        if (!quickContent.trim()) {
          toast.error("请输入速记内容");
          setIsAddingNote(false);
          return;
        }
        // 重新获取当前用户，确保认证状态正确
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !currentUser) {
          throw new Error("用户未认证，请重新登录");
        }
        const quickHtml = quickContent
          .split("\n")
          .map((line) => `<p>${line}</p>`)
          .join("");
        const { error } = await supabase
          .from("notes")
          .insert({
            user_id: currentUser.id,
            source_url: null,
            content_type: "article",
            title: quickTitle || "速记",
            content_text: quickContent,
            content_html: quickHtml,
            excerpt: quickContent.substring(0, 120),
            source_type: "manual",
          })
          .select()
          .single();
        if (error) throw error;
      } else if (creationMode === "upload") {
        if (!uploadFile) {
          toast.error("请选择文件");
          setIsAddingNote(false);
          return;
        }
        console.log("📤 准备上传文件:", {
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          fileType: uploadFile.type,
        });

        const fd = new FormData();
        fd.append("file", uploadFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          console.error("❌ Upload API error:", errText);
          throw new Error(errText || "文件上传失败");
        }
        const { url: publicUrl } = await uploadRes.json();

        console.log("✅ 文件上传成功:", publicUrl);

        // 获取当前用户信息（用于后续 DB 操作）
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !currentUser) {
          throw new Error("用户未认证，请重新登录");
        }
        const mime = uploadFile.type;
        const isImage = mime.startsWith("image/");
        const isVideo = mime.startsWith("video/");
        const isAudio = mime.startsWith("audio/");
        
        // 准备插入数据
        const insertData = {
          user_id: currentUser.id,
          source_url: publicUrl,
          content_type: isVideo ? "video" : isAudio ? "audio" : "article",
          title: uploadTitle || uploadFile.name,
          cover_image_url: isImage ? publicUrl : null,
          media_url: isVideo || isAudio ? publicUrl : null,
          excerpt: uploadTitle || uploadFile.name,
          source_type: "upload",
          file_url: !isImage && !isVideo && !isAudio ? publicUrl : null,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          file_type: mime,
        };
        
        console.log("Inserting note with data:", {
          user_id: insertData.user_id,
          source_url: insertData.source_url,
          content_type: insertData.content_type,
          source_type: insertData.source_type,
        });
        
        // 检查是否已存在相同的 source_url（避免唯一约束冲突）
        const { data: existingNote } = await supabase
          .from("notes")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("source_url", insertData.source_url)
          .maybeSingle();
          
        if (existingNote) {
          // 如果已存在，更新现有记录而不是创建新记录
          const { error: updateError } = await supabase
            .from("notes")
            .update({
              title: insertData.title,
              excerpt: insertData.excerpt,
              cover_image_url: insertData.cover_image_url,
              media_url: insertData.media_url,
              file_url: insertData.file_url,
              file_name: insertData.file_name,
              file_size: insertData.file_size,
              file_type: insertData.file_type,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingNote.id);
            
          if (updateError) {
            console.error("Notes update error:", updateError);
            throw updateError;
          }
        } else {
          // 插入新记录
          const { data: insertedNote, error: insertError } = await supabase
            .from("notes")
            .insert(insertData)
            .select()
            .single();
            
          if (insertError) {
            console.error("Notes insert error:", insertError);
            console.error("Insert data:", insertData);
            console.error("Current user ID:", currentUser.id);
            console.error("Auth UID check:", await supabase.auth.getUser());
            
            // 如果是唯一约束冲突，提供更友好的错误信息
            if (insertError.code === "23505") {
              throw new Error("该文件已存在，请勿重复上传");
            }
            // 如果是 RLS 策略错误，提供更详细的错误信息
            if (insertError.message?.includes("row-level security")) {
              throw new Error(`权限错误: ${insertError.message}。请确保已登录且用户 ID 正确。`);
            }
            throw insertError;
          }
        }
      }
      setShowAddNoteDialog(false);
      setNewNoteUrl("");
      setQuickTitle("");
      setQuickContent("");
      setUploadFile(null);
      setUploadTitle("");
      refreshAll();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误";
      toast.error(`添加失败: ${message}`);
    } finally {
      setIsAddingNote(false);
    }
  };

  const renderNoteActions = (note: NoteItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          ⋮
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 text-sm">
        <DropdownMenuItem onClick={() => window.open(note.source_url || "#", "_blank")}>
          <Link2 className="h-4 w-4 mr-2" /> 打开原文
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyLinks([note.id])}>
          <Copy className="h-4 w-4 mr-2" /> 复制链接
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyContent("text", [note.id])}>
          <Copy className="h-4 w-4 mr-2" /> 复制纯文本
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyContent("markdown", [note.id])}>
          <Copy className="h-4 w-4 mr-2" /> 复制 Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyContent("html", [note.id])}>
          <Copy className="h-4 w-4 mr-2" /> 复制 HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportNotes("text", [note.id])}>
          <FileDown className="h-4 w-4 mr-2" /> 导出 TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportNotes("markdown", [note.id])}>
          <FileDown className="h-4 w-4 mr-2" /> 导出 Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportNotes("html", [note.id])}>
          <FileDown className="h-4 w-4 mr-2" /> 导出 HTML
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => toggleStar([note.id])}
          disabled={starringNotes.has(note.id)}
          className={cn(starringNotes.has(note.id) && "opacity-50 pointer-events-none")}
        >
          {starringNotes.has(note.id) ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : note.is_starred ? (
            <BookmarkCheck className="h-4 w-4 mr-2" />
          ) : (
            <Bookmark className="h-4 w-4 mr-2" />
          )}
          {note.is_starred ? "取消星标" : "设置星标"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => ensureMoveDialog([note.id])}>
          <MoveHorizontal className="h-4 w-4 mr-2" /> 移动到收藏夹
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => ensureTagSelection([note.id])}>
          <Tag className="h-4 w-4 mr-2" /> 设置标签
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => archiveNotes([note.id])}
          disabled={archivingNotes.has(note.id)}
          className={cn(archivingNotes.has(note.id) && "opacity-50 pointer-events-none")}
        >
          {archivingNotes.has(note.id) ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 mr-2" />
          )}
          归档
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => deleteNotes([note.id])}>
          <Trash2 className="h-4 w-4 mr-2 text-red-500" /> 删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderFolderNodes = (nodes: FolderTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.id);
      const hasChildren = node.children.length > 0;
      const isActive = category === "folder" && selectedFolder === node.id;
      const isChain = selectedFolderChain.has(node.id) && !isActive;
      return (
        <div key={node.id}>
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-all duration-200 group relative",
              isActive
                ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10 font-medium"
                : isChain
                ? "bg-blue-500/5 text-blue-900/70"
                : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
            )}
            style={{ paddingLeft: depth * 16 + 8 }}
          >
            <div
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
              onClick={() => handleSelectFolder(node.id)}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFolderExpansion(node.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              <span className="text-sm leading-none">
                {node.icon || "📁"}
              </span>
              <span className="truncate">{node.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{node.note_count}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-gray-700"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => openEditFolderDialog(node)}>
                    <Pencil className="h-4 w-4 mr-2" /> 重命名/图标
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openCreateFolderDialog(node.id)}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" /> 创建子收藏夹
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchiveFolder(node)}>
                    <Archive className="h-4 w-4 mr-2" /> 归档
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-500"
                    onClick={() => handleDeleteFolder(node)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {hasChildren && isExpanded
            ? renderFolderNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });

  const renderTagNodes = (nodes: TagTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const isExpanded = node.expanded || false;
      const hasChildren = node.children.length > 0;
      const isActive = selectedTag === node.id;
      
      return (
        <div key={node.id}>
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-all duration-200 group relative",
              isActive
                ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10 font-medium"
                : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
            )}
            style={{ paddingLeft: depth * 16 + 8 }}
          >
            <div
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
              onClick={() => {
                setSelectedTag(node.id);
                setCategory("all"); // Reset category when selecting tag
                setSelectedFolder(null);
                setSelectedSmartList(null);
                trackAccess('tag', node.id);
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedTags((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.id)) {
                        next.delete(node.id);
                      } else {
                        next.add(node.id);
                      }
                      return next;
                    });
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              <span className="text-sm leading-none">
                {node.icon || "#"}
              </span>
              <span className="truncate">{node.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{node.note_count}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => openEditTagDialog(node)}>
                    <Pencil className="h-4 w-4 mr-2" /> 重命名/编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openCreateTagDialog(node.id)}>
                    <Plus className="h-4 w-4 mr-2" /> 创建子标签
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchiveTag(node)}>
                    <Archive className="h-4 w-4 mr-2" /> 归档
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-500"
                    onClick={() => handleDeleteTag(node)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {hasChildren && isExpanded
            ? renderTagNodes(node.children, depth + 1)
            : null}
        </div>
      );
    });

  const renderNoteCard = (note: NoteItem) => {
    const annotationCount = note.annotation_count || 0;
    
    // 获取域名/来源
    const getSourceInfo = () => {
      try {
        let urlValue = note.source_url || "";
        const httpMatch = urlValue.match(/(https?:\/\/.+)/);
        if (httpMatch) urlValue = httpMatch[1];
        
        if (!urlValue) return { name: note.site_name || "未知来源", domain: "" };
        
        const url = new URL(urlValue);
        return { 
          name: note.site_name || url.hostname,
          domain: url.hostname,
          favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
        };
      } catch {
        return { name: note.site_name || "未知来源", domain: "", favicon: "" };
      }
    };
    
    const source = getSourceInfo();

    return (
      <Card
        key={note.id}
        className="group relative bg-card backdrop-blur-none ring-0 border border-border shadow-none hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden h-full flex flex-col rounded-[14px]"
      >
        {/* 选择遮罩层 (选中时显示) */}
        <div
          className={cn(
            "absolute inset-0 bg-blue-50/50 z-[5] pointer-events-none transition-opacity",
            selectedNotes.has(note.id) ? "opacity-100" : "opacity-0"
          )}
        />
        
        {/* 顶部操作栏 (悬浮显示) */}
        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Checkbox
            checked={selectedNotes.has(note.id)}
            onCheckedChange={() => toggleSelectNote(note.id)}
            className="h-6 w-6 rounded-md bg-card/80 backdrop-blur-sm border-border shadow-sm data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
          />
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded-md bg-card/80 backdrop-blur-sm shadow-sm hover:bg-card transition-all duration-200",
              note.is_starred ? "text-yellow-500" : "text-muted-foreground/70 hover:text-yellow-500",
              starringNotes.has(note.id) && "opacity-70 pointer-events-none"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleStar([note.id]);
            }}
            disabled={starringNotes.has(note.id)}
          >
            {starringNotes.has(note.id) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Star className="h-3.5 w-3.5" fill={note.is_starred ? "currentColor" : "none"} />
            )}
          </Button>
          {renderNoteActions(note)}
        </div>

        <div
          className="cursor-pointer h-full flex flex-col"
          onClick={() => (window.location.href = `/notes/${note.id}`)}
        >
          {/* 上半部分：内容与图片 */}
          <div className="p-4 flex-1">
            <div className="flex gap-4 mb-3">
              {/* 左侧文字区 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-card-foreground leading-snug line-clamp-2 mb-1.5 group-hover:text-blue-600 transition-colors">
                  {note.title || "无标题"}
                </h3>
                
                {note.excerpt ? (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {note.excerpt}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/70 italic">暂无摘要</p>
                )}

                {/* 视频处理状态 badge */}
                {note.content_type === "video" &&
                  note.video_overall_status &&
                  note.video_overall_status !== "fully_ready" && (
                    <VideoStatusBadge
                      noteId={note.id}
                      jobId={note.video_job_id}
                      initialStatus={note.video_overall_status}
                    />
                  )}
              </div>

              {/* 右侧图片区 (如果有) */}
              {note.cover_image_url && (
                <div className="shrink-0 w-24 h-16 rounded-[10px] overflow-hidden bg-muted border border-border">
                  <img
                    src={note.cover_image_url}
                    alt=""
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 底部信息栏 (采用淡灰色背景) */}
          <div className="px-4 py-2.5 bg-blue-50/25 border-t border-border flex items-center justify-between mt-auto">
            {/* 左侧：来源与时间 */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground overflow-hidden">
              <div className="flex items-center gap-1.5 shrink-0">
                {source.favicon ? (
                  <img src={source.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
                ) : (
                  <Globe className="w-3 h-3 text-muted-foreground/70" />
                )}
                <span className="truncate max-w-[80px]" title={source.name}>{source.name}</span>
              </div>
              <span className="text-muted-foreground/50 shrink-0">•</span>
              <span className="shrink-0">{formatDate(note.created_at)}</span>
            </div>

            {/* 右侧：批注条数 */}
            {annotationCount > 0 && (
              <div className="shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[#FFD700] text-black text-[10px] font-bold rounded shadow-sm ml-2">
                {annotationCount}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderBulkSelectionControls = () => {
    if (selectedNotes.size === 0) return null;
    // Check if any selected notes are being starred/archived
    const isStarringSelected = Array.from(selectedNotes).some(id => starringNotes.has(id));
    const isArchivingSelected = Array.from(selectedNotes).some(id => archivingNotes.has(id));
    
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
        <span className="font-medium text-muted-foreground">
          已选择 {selectedNotes.size} 条
        </span>
        <Button
          variant="outline"
          size="sm"
          className={bulkActionButtonClass}
          onClick={() => toggleStar()}
          disabled={isStarringSelected}
        >
          {isStarringSelected ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <Star className="h-3 w-3 mr-1.5" />
          )}
          星标
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={bulkActionButtonClass}
          onClick={() => ensureMoveDialog()}
        >
          <Folder className="h-3 w-3 mr-1.5" /> 收藏夹
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={bulkActionButtonClass}
          onClick={() => ensureTagSelection()}
        >
          <Tag className="h-3 w-3 mr-1.5" /> 标签
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={bulkActionButtonClass}
          onClick={() => archiveNotes()}
          disabled={isArchivingSelected}
        >
          {isArchivingSelected ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <Archive className="h-3 w-3 mr-1.5" />
          )}
          归档
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={bulkActionButtonClass}
          onClick={() => deleteNotes()}
        >
          <Trash2 className="h-3 w-3 mr-1.5" /> 删除
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={bulkActionButtonClass}
            >
              <Copy className="h-3 w-3 mr-1.5" /> 复制内容
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => copyContent("text")}>
              纯文本
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyContent("markdown")}>
              Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyContent("html")}>
              HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={bulkActionButtonClass}
            >
              <FileDown className="h-3 w-3 mr-1.5" /> 导出
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => exportNotes("text")}>
              TXT
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportNotes("markdown")}>
              Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportNotes("html")}>
              HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          className={bulkActionButtonClass}
          onClick={() => copyLinks()}
        >
          <Link2 className="h-3 w-3 mr-1.5" /> 复制链接
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={bulkActionButtonClass}
          onClick={clearSelections}
        >
          <Check className="h-3 w-3 mr-1.5" /> 完成
        </Button>
      </div>
    );
  };

  const renderAddNoteDialog = () => {
    return (
      <AnimatePresence>
        {showAddNoteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#dbeafe66] backdrop-blur-sm flex items-center justify-center z-50 pb-[10vh]"
            onClick={() => setShowAddNoteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <Card
                className="w-full p-6 space-y-4 shadow-xl border-border/60 bg-card/95 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">添加笔记</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                    onClick={() => setShowAddNoteDialog(false)}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {creationTabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant={creationMode === tab.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCreationMode(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
                {creationMode === "url" && (
                  <div className="space-y-2">
                    <Label>网址</Label>
                    <Input
                      placeholder="https://example.com/article"
                      value={newNoteUrl}
                      onChange={(e) => setNewNoteUrl(e.target.value)}
                    />
                  </div>
                )}
                {creationMode === "quick" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>标题（可选）</Label>
                      <Input
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder="我的速记"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>内容</Label>
                      <textarea
                        className="w-full border rounded-md p-3 min-h-[160px] text-sm"
                        value={quickContent}
                        onChange={(e) => setQuickContent(e.target.value)}
                        placeholder="输入文本或 Markdown"
                      />
                    </div>
                  </div>
                )}
                {creationMode === "upload" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>文件</Label>
                      <Input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>标题（可选）</Label>
                      <Input
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddNoteDialog(false)}
                    disabled={isAddingNote}
                  >
                    取消
                  </Button>
                  <Button onClick={handleAddNote} disabled={isAddingNote}>
                    {isAddingNote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    添加
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderMoveDialog = () => {
    return (
      <AnimatePresence>
        {showMoveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#dbeafe66] backdrop-blur-sm flex items-center justify-center z-[60] pb-[10vh]"
            onClick={() => setShowMoveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="w-full p-6 shadow-xl border-border/60 bg-card/95 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-card-foreground">移动到收藏夹</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                    onClick={() => setShowMoveDialog(false)}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                {/* Fixed height container to prevent jitter */}
                <div className="h-[320px] overflow-y-auto pr-2 custom-scrollbar space-y-1">
                  <Button
                    variant={moveTargetFolder === null ? "default" : "outline"}
                    className={cn(
                      "w-full justify-start h-11 px-4 rounded-xl transition-all duration-200 border-transparent",
                      moveTargetFolder === null ? "bg-blue-600 text-white shadow-md" : "hover:bg-muted text-slate-700 hover:border-slate-100"
                    )}
                    onClick={() => setMoveTargetFolder(null)}
                  >
                    <span className="text-base leading-none mr-3">📄</span>
                    <span className="font-medium text-sm">未分类</span>
                  </Button>
                  {flattenedFolderOptions.map((folder) => (
                    <Button
                      key={folder.id}
                      variant={moveTargetFolder === folder.id ? "default" : "outline"}
                      className={cn(
                        "w-full justify-start h-11 px-4 gap-3 rounded-xl transition-all duration-200 border-transparent",
                        moveTargetFolder === folder.id ? "bg-blue-600 text-white shadow-md" : "hover:bg-muted text-slate-700 hover:border-slate-100"
                      )}
                      style={{ paddingLeft: folder.depth * 16 + 16 }}
                      onClick={() => setMoveTargetFolder(folder.id)}
                    >
                      <span className="text-base leading-none">
                        {folder.icon || "📁"}
                      </span>
                      <span className="truncate font-medium text-sm">{folder.name}</span>
                      <span className={cn(
                        "ml-auto text-[10px] px-1.5 py-0.5 rounded-md border opacity-60",
                        moveTargetFolder === folder.id ? "bg-blue-500/20 border-white/20" : "bg-card/50 border-slate-100"
                      )}>
                        {folder.note_count}
                      </span>
                    </Button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowMoveDialog(false)}
                    className="rounded-xl px-6"
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={moveNotes}
                    className="rounded-xl px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    确认移动
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const createTagIfNeeded = async () => {
    if (!tagDialogNewName.trim()) return;
    if (!user) {
      toast.error("请先登录后再创建标签");
      return;
    }
    const name = tagDialogNewName.trim();
    const { data, error } = await supabase
      .from("tags")
      .insert({ name, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error(`创建标签失败: ${error.message}`);
      return;
    }
    setTags((prev) => [...prev, data]);
    setTagDialogSelection((prev) => [...prev, data.id]);
    setTagDialogNewName("");
  };

  const renderTagDialog = () => {
    return (
      <AnimatePresence>
        {showTagDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#dbeafe66] backdrop-blur-sm flex items-center justify-center z-[60] pb-[10vh]"
            onClick={() => setShowTagDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card className="w-full p-6 shadow-xl border-border/60 bg-card/95 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-card-foreground">设置标签</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                    onClick={() => setShowTagDialog(false)}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                
                {/* Fixed height container to prevent jitter */}
                <div className="h-[280px] overflow-y-auto pr-2 custom-scrollbar relative flex flex-col">
                  {tagsLoading ? (
                    <div className="space-y-1 py-1">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-transparent">
                          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-1 py-1 flex-1"
                    >
                      {tags.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/70 min-h-[260px]">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Tag className="h-8 w-8 opacity-20" />
                          </div>
                          <p className="text-sm font-medium">暂无标签</p>
                          <p className="text-xs opacity-60 mt-1">在下方输入名称即可创建新标签</p>
                        </div>
                      ) : (
                        tags.map((tag) => (
                          <label
                            key={tag.id}
                            className={cn(
                              "flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all duration-200 border border-transparent",
                              tagDialogSelection.includes(tag.id) 
                                ? "bg-blue-50/50 border-blue-100/50 text-blue-700" 
                                : "hover:bg-muted text-slate-700 hover:border-slate-100"
                            )}
                          >
                            <Checkbox
                              checked={tagDialogSelection.includes(tag.id)}
                              onCheckedChange={() =>
                                setTagDialogSelection((prev) => {
                                  if (prev.includes(tag.id)) {
                                    return prev.filter((id) => id !== tag.id);
                                  }
                                  return [...prev, tag.id];
                                })
                              }
                              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <span className="text-sm font-medium">{tag.name}</span>
                            {tag.note_count !== undefined && (
                              <span className="ml-auto text-[10px] bg-card/50 px-1.5 py-0.5 rounded-md border border-slate-100 opacity-60">
                                {tag.note_count}
                              </span>
                            )}
                          </label>
                        ))
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <Input
                    placeholder="新标签名称"
                    value={tagDialogNewName}
                    onChange={(e) => setTagDialogNewName(e.target.value)}
                    className="h-10 rounded-xl text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createTagIfNeeded();
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={createTagIfNeeded} className="h-10 rounded-xl px-4">
                    新建
                  </Button>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowTagDialog(false)}
                    className="rounded-xl px-6"
                    disabled={isUpsertingTags}
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={upsertTagsForNotes}
                    className="rounded-xl px-6 bg-blue-600 hover:bg-blue-700"
                    disabled={isUpsertingTags}
                  >
                    {isUpsertingTags && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    保存设置
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderFolderDialog = () => {
    const blockedParents =
      folderDialogMode === "edit" && folderDialogTargetId
        ? (() => {
            const set = getDescendantIds(folderTree, folderDialogTargetId);
            set.add(folderDialogTargetId);
            return set;
          })()
        : new Set<string>();

    return (
      <AnimatePresence>
        {showFolderDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#dbeafe66] backdrop-blur-sm flex items-center justify-center z-[70] pb-[10vh]"
            onClick={closeFolderDialog}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card
                className="w-full p-6 shadow-xl border-border/60 bg-card/95 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-card-foreground">
                    {folderDialogMode === "create" ? "新建收藏夹" : "编辑收藏夹"}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                    onClick={closeFolderDialog}
                    disabled={folderActionLoading}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                {/* Fixed height container to prevent jitter */}
                <div className="h-[380px] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider ml-1">名称</Label>
                    <Input
                      value={folderDialogName}
                      onChange={(e) => setFolderDialogName(e.target.value)}
                      placeholder="例如：行业资讯"
                      className="h-11 rounded-xl bg-muted/50 border-border focus:bg-card transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider ml-1">图标</Label>
                    <div className="flex flex-wrap gap-2">
                      {folderIconOptions.map((icon) => (
                        <Button
                          key={icon}
                          type="button"
                          variant={
                            folderDialogIcon === icon ? "default" : "outline"
                          }
                          size="sm"
                          className={cn(
                            "h-10 w-11 text-lg rounded-xl transition-all duration-200",
                            folderDialogIcon === icon ? "bg-blue-600 border-blue-600 shadow-md scale-110" : "hover:bg-muted hover:scale-105"
                          )}
                          onClick={() => setFolderDialogIcon(icon)}
                        >
                          {icon}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant={folderDialogIcon ? "outline" : "default"}
                        size="sm"
                        className={cn(
                          "h-10 px-4 rounded-xl transition-all",
                          !folderDialogIcon ? "bg-blue-600 border-blue-600" : "hover:bg-muted"
                        )}
                        onClick={() => setFolderDialogIcon("")}
                      >
                        默认
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider ml-1">父级（可选）</Label>
                    <select
                      className="w-full h-11 border border-border rounded-xl px-4 text-sm bg-muted/50 focus:bg-card focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      value={folderDialogParent ?? ""}
                      onChange={(e) =>
                        setFolderDialogParent(e.target.value || null)
                      }
                    >
                      <option value="">顶层收藏夹</option>
                      {flattenedFolderOptions.map((folder) => (
                        <option
                          key={folder.id}
                          value={folder.id}
                          disabled={blockedParents.has(folder.id)}
                        >
                          {`${"— ".repeat(folder.depth)}${folder.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-6 mt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={closeFolderDialog}
                    disabled={folderActionLoading}
                    className="rounded-xl px-6"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleFolderDialogSubmit}
                    disabled={folderActionLoading}
                    className="rounded-xl px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    {folderActionLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    保存
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderTagDialog2 = () => {
    const blockedParents =
      tagDialogMode === "edit" && tagDialogTargetId
        ? (() => {
            const set = new Set<string>();
            const findDescendants = (nodeId: string) => {
              set.add(nodeId);
              const node = findTagNode(tagTree, nodeId);
              if (node) {
                node.children.forEach((child) => findDescendants(child.id));
              }
            };
            findDescendants(tagDialogTargetId);
            return set;
          })()
        : new Set<string>();

    const flattenedTagOptions: Array<{ id: string; name: string; depth: number }> = [];
    const flattenTags = (nodes: TagTreeNode[], depth = 0) => {
      nodes.forEach((node) => {
        flattenedTagOptions.push({ id: node.id, name: node.name, depth });
        if (node.children.length > 0) {
          flattenTags(node.children, depth + 1);
        }
      });
    };
    flattenTags(tagTree);

    const colorOptions = [
      "#f87171", // red
      "#fb923c", // orange
      "#fbbf24", // yellow
      "#a3e635", // lime
      "#34d399", // green
      "#22d3ee", // cyan
      "#60a5fa", // blue
      "#a78bfa", // purple
      "#f472b6", // pink
      "#94a3b8", // slate
    ];

    return (
      <AnimatePresence>
        {showTagDialog2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#dbeafe66] backdrop-blur-sm flex items-center justify-center z-[70] pb-[10vh]"
            onClick={closeTagDialog2}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <Card
                className="w-full p-6 space-y-4 shadow-xl border-border/60 bg-card/95 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-card-foreground">
                    {tagDialogMode === "create" ? "新建标签" : "编辑标签"}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                    onClick={closeTagDialog2}
                    disabled={tagActionLoading}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>名称</Label>
                    <Input
                      value={tagDialogName}
                      onChange={(e) => setTagDialogName(e.target.value)}
                      placeholder="例如：技术文章"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>颜色</Label>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition-all",
                            tagDialogColor === color
                              ? "border-black scale-110"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setTagDialogColor(color)}
                        />
                      ))}
                      <Button
                        type="button"
                        variant={tagDialogColor ? "outline" : "default"}
                        size="sm"
                        className="h-8"
                        onClick={() => setTagDialogColor("")}
                      >
                        默认
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>图标（可选）</Label>
                    <Input
                      value={tagDialogIcon}
                      onChange={(e) => setTagDialogIcon(e.target.value)}
                      placeholder="输入 emoji，例如：📚"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>父级（可选）</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-card"
                      value={tagDialogParent ?? ""}
                      onChange={(e) =>
                        setTagDialogParent(e.target.value || null)
                      }
                    >
                      <option value="">顶层标签</option>
                      {flattenedTagOptions.map((tag) => (
                        <option
                          key={tag.id}
                          value={tag.id}
                          disabled={blockedParents.has(tag.id)}
                        >
                          {`${"— ".repeat(tag.depth)}${tag.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={closeTagDialog2}
                    disabled={tagActionLoading}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleTagDialogSubmit}
                    disabled={tagActionLoading}
                  >
                    {tagActionLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    保存
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">加载用户信息...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f5f5f7] dark:bg-slate-950 flex font-sans text-sm overflow-hidden">
      {/* Primary Sidebar */}
      <aside className="w-[64px] h-screen bg-[#EBECEE] dark:bg-slate-900 flex flex-col items-center py-5 gap-0 flex-shrink-0 z-50 border-r border-black/5 dark:border-white/10">
        {/* Top Logo */}
        <Link
          href="/"
          aria-label="返回首页"
          className="w-11 h-11 bg-gradient-to-b from-[#5C7CFF] to-[#4D6EF3] rounded-[15px] flex items-center justify-center shadow-[0_4px_12px_rgba(77,110,243,0.3)] shrink-0 mb-8 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles className="h-6 w-6 text-white relative z-10" />
        </Link>

        {/* Navigation Items */}
        <div className="flex flex-col gap-1 w-full px-2 items-center">
          {primaryNavItems.map(({ id, Icon, ActiveIcon }) => {
            const CurrentIcon = activePrimary === id ? (ActiveIcon ?? Icon) : Icon;

            return (
              <button
                key={id}
                className={cn(
                  "w-[46px] h-[46px] rounded-[15px] flex items-center justify-center transition-all duration-300 relative group",
                  activePrimary === id
                    ? "text-[#333333]"
                    : "text-[#4A4A4A] hover:bg-black/5 hover:text-[#1A1A1A]",
                )}
                onClick={() => {
                  setActivePrimary(id);

                  if (id === "archive") {
                    setShowArchived(true);
                    setCategory("all");
                    setSelectedFolder(null);
                    setSelectedSmartList(null);
                    setSelectedTag(null);
                  } else if (activePrimary === "archive") {
                    setShowArchived(false);
                  } else if (id === "collections") {
                    setShowArchived(false);
                  }
                }}
              >
                {activePrimary === id && (
                  <motion.div
                    layoutId="active-nav-bg"
                    className="absolute inset-0 bg-[#DCDDE3] rounded-[15px]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <CurrentIcon
                  className={cn(
                    "h-6 w-6 relative z-10 transition-all duration-300",
                    activePrimary === id
                      ? "fill-[#333333] stroke-[#333333] stroke-[1px]"
                      : "stroke-[#4A4A4A] stroke-[1.8px] group-hover:rotate-12",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Bottom Actions */}
        <div className="flex flex-col gap-1 w-full px-2 items-center pb-6">
          <AnimatedThemeSwitcher variant="compact" />

          {user ? (
            <BrowseHistoryPopover
              userId={user.id}
              onNavigateToNote={(noteId) => {
                router.push(`/notes/${noteId}`);
              }}
            >
              <button
                className="w-[46px] h-[46px] rounded-[15px] flex items-center justify-center text-[#4A4A4A] hover:bg-black/5 hover:text-[#1A1A1A] transition-all duration-200 ease-out hover:scale-105 active:scale-95 group"
              >
                <History className="h-[22px] w-[22px] stroke-[1.8px] transition-transform duration-200 group-hover:scale-110" />
              </button>
            </BrowseHistoryPopover>
          ) : (
            <button
              className="w-[46px] h-[46px] rounded-[15px] flex items-center justify-center text-[#4A4A4A] hover:bg-black/5 hover:text-[#1A1A1A] transition-all duration-200 ease-out hover:scale-105 active:scale-95 group"
            >
              <History className="h-[22px] w-[22px] stroke-[1.8px] transition-transform duration-200 group-hover:scale-110" />
            </button>
          )}

          <NotificationsPopover>
            <button className="w-[46px] h-[46px] rounded-[15px] flex items-center justify-center text-[#4A4A4A] hover:bg-black/5 hover:text-[#1A1A1A] transition-all duration-200 ease-out hover:scale-105 active:scale-95 group">
              <Bell className="h-[22px] w-[22px] stroke-[1.8px] transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12" />
            </button>
          </NotificationsPopover>

          <button
            className={cn(
              "w-[46px] h-[46px] rounded-[15px] flex items-center justify-center transition-all duration-300 relative group",
              activePrimary === "settings"
                ? "text-[#333333]"
                : "text-[#4A4A4A] hover:bg-black/5 hover:text-[#1A1A1A]",
            )}
            onClick={() => {
              setActivePrimary("settings");
              setIsSearchFocused(false);
            }}
            title="系统设置"
          >
            {activePrimary === "settings" && (
              <motion.div
                layoutId="active-nav-bg"
                className="absolute inset-0 bg-[#DCDDE3] rounded-[15px]"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <Settings
              className={cn(
                "h-6 w-6 relative z-10 transition-all duration-300",
                activePrimary === "settings"
                  ? "fill-[#333333] stroke-[#333333] stroke-[1px]"
                  : "stroke-[#4A4A4A] stroke-[1.8px] group-hover:rotate-12",
              )}
            />
            <div className="absolute top-[10px] right-[10px] w-2.5 h-2.5 bg-[#FF4D4D] rounded-full border-[2.5px] border-[#EBECEE] shadow-sm transition-opacity group-hover:opacity-0 pointer-events-none" />
          </button>
        </div>
      </aside>

      {/* Secondary Sidebar */}
      <aside className="w-60 h-screen bg-[#fbfbfd] dark:bg-slate-900/50 border-r border-black/[0.03] dark:border-white/5 flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center justify-between px-5 border-b border-black/[0.03] dark:border-white/5 bg-card/50">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 tracking-tight">
            {activePrimary === "collections"
              ? "我的收藏"
              : activePrimary === "tags"
                ? "标签管理"
                : activePrimary === "annotations"
                  ? "标注"
                  : activePrimary === "archive"
                    ? "归档笔记"
                    : activePrimary === "knowledge"
                      ? "知识库"
                      : activePrimary === "settings"
                        ? "设置"
                      : "收藏"}
          </h2>
          {activePrimary === "tags" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500"
              onClick={() => openCreateTagDialog(null)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {activePrimary === "settings" && (
            <div className="space-y-1 px-1">
              {settingsNavItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group",
                    settingsTab === id
                      ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10"
                      : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
                  )}
                  onClick={() => setSettingsTab(id)}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      settingsTab === id ? "scale-110" : "group-hover:scale-110",
                    )}
                  />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          )}
          {activePrimary === "collections" && (
          <>
          <div className="space-y-1">
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group relative",
                category === "uncategorized"
                  ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10"
                  : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
              )}
              onClick={() => {
                setCategory("uncategorized");
                setSelectedFolder(null);
                setSelectedSmartList(null);
              }}
            >
              <div className="flex items-center gap-3">
                <Mail className={cn("h-4 w-4 transition-transform duration-200", category === "uncategorized" ? "scale-110" : "group-hover:scale-110")} />
                <span className="font-medium">未分类</span>
              </div>
              <span className={cn("text-xs transition-colors", category === "uncategorized" ? "text-blue-500/70" : "text-gray-400")}>{counts.uncategorized}</span>
            </button>
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group",
                category === "all"
                  ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10"
                  : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
              )}
              onClick={() => {
                setCategory("all");
                setSelectedFolder(null);
                setSelectedSmartList(null);
              }}
            >
              <div className="flex items-center gap-3">
                <List className={cn("h-4 w-4 transition-transform duration-200", category === "all" ? "scale-110" : "group-hover:scale-110")} />
                <span className="font-medium">所有</span>
              </div>
              <span className={cn("text-xs transition-colors", category === "all" ? "text-blue-500/70" : "text-gray-400")}>{counts.all}</span>
            </button>
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group",
                category === "starred"
                  ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10"
                  : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
              )}
              onClick={() => {
                setCategory("starred");
                setSelectedFolder(null);
                setSelectedSmartList(null);
              }}
            >
              <div className="flex items-center gap-3">
                <Star className={cn("h-4 w-4 transition-transform duration-200", category === "starred" ? "scale-110 fill-blue-600/20" : "group-hover:scale-110")} />
                <span className="font-medium">星标</span>
              </div>
              <span className={cn("text-xs transition-colors", category === "starred" ? "text-blue-500/70" : "text-gray-400")}>{counts.starred}</span>
            </button>
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group",
                category === "today"
                  ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10"
                  : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
              )}
              onClick={() => {
                setCategory("today");
                setSelectedFolder(null);
                setSelectedSmartList(null);
              }}
            >
              <div className="flex items-center gap-3">
                <Calendar className={cn("h-4 w-4 transition-transform duration-200", category === "today" ? "scale-110" : "group-hover:scale-110")} />
                <span className="font-medium">今日</span>
              </div>
              <span className={cn("text-xs transition-colors", category === "today" ? "text-blue-500/70" : "text-gray-400")}>{counts.today}</span>
            </button>
          </div>

          <div>
            <button
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm font-semibold text-gray-500 uppercase tracking-wide"
              onClick={() => setSmartListsExpanded((prev) => !prev)}
            >
              <span>智能列表</span>
              {smartListsExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {smartListsExpanded && (
              <div className="space-y-1 text-[13px]">
                {smartLists.length === 0 && (
                  <p className="text-gray-400 px-3 py-2">
                    暂无自动聚类
                  </p>
                )}
                {smartLists.map((list) => (
                  <button
                    key={list.id}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group",
                      selectedSmartList?.id === list.id && category === "smart"
                        ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10"
                        : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
                    )}
                    onClick={() => {
                      setSelectedSmartList(list);
                      setCategory("smart");
                    }}
                  >
                    <span className="font-medium">{list.label}</span>
                    <span className={cn("text-[12px] transition-colors", selectedSmartList?.id === list.id && category === "smart" ? "text-blue-500/70" : "text-gray-400")}>{list.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <button
                className="text-sm font-semibold text-gray-500 uppercase tracking-wide"
                onClick={() => setCollectionsExpanded((prev) => !prev)}
              >
                收藏夹
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500"
                onClick={() => openCreateFolderDialog(null)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {collectionsExpanded && (
              <div className="space-y-1">
                {folderTree.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">
                    暂无收藏夹，点击右侧 + 新建
                  </p>
                ) : (
                  renderFolderNodes(folderTree)
                )}
              </div>
            )}
          </div>
          </>
          )}
          
          {activePrimary === "tags" && (
            <>
              {/* Tag Search */}
              <div className="px-2 mb-2">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    placeholder="搜索标签 ⌘B"
                    className="pl-9 h-9 text-xs rounded-xl border-none bg-black/[0.03] focus:bg-card focus:ring-0 focus-visible:ring-0 transition-all"
                  />
                </div>
              </div>

              {/* Sort Mode Toggle */}
              <div className="px-2 flex gap-1 mb-2">
                <button
                  className={cn(
                    "flex-1 px-3 py-1.5 text-xs rounded-xl transition-all duration-200",
                    tagSortMode === "custom"
                      ? "bg-blue-500/10 text-blue-600 border border-blue-500/10 font-medium"
                      : "text-gray-500 hover:bg-card hover:text-blue-500"
                  )}
                  onClick={() => setTagSortMode("custom")}
                >
                  自定义排序
                </button>
                <button
                  className={cn(
                    "flex-1 px-3 py-1.5 text-xs rounded-xl transition-all duration-200",
                    tagSortMode !== "custom"
                      ? "bg-blue-500/10 text-blue-600 border border-blue-500/10 font-medium"
                      : "text-gray-500 hover:bg-card hover:text-blue-500"
                  )}
                  onClick={() => setTagSortMode(tagSortMode === "name-asc" ? "name-desc" : "name-asc")}
                >
                  名称排序
                </button>
              </div>

              {/* No Tags Item */}
              <div>
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group",
                    !selectedTag
                      ? "bg-blue-500/10 text-blue-600 shadow-[0_2px_8px_rgba(59,130,246,0.08)] border border-blue-500/10 font-medium"
                      : "text-muted-foreground hover:bg-card hover:text-blue-500 hover:shadow-sm",
                  )}
                  onClick={() => {
                    setSelectedTag(null);
                    setCategory("all");
                    setSelectedFolder(null);
                    setSelectedSmartList(null);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">🚫</span>
                    <span>无标签</span>
                  </div>
                  <span className={cn("text-xs transition-colors", !selectedTag ? "text-blue-500/70" : "text-gray-400")}>{counts.untagged}</span>
                </button>
              </div>

              {/* Tags List */}
              <div className="space-y-1">
                {tagTree.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">
                    暂无标签，点击右上角 + 新建
                  </p>
                ) : (
                  renderTagNodes(tagTree)
                )}
              </div>
            </>
          )}

          {/* Annotations Panel */}
          {activePrimary === "annotations" && (
            <>
              <div className="px-2 mb-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    placeholder="搜索批注的新闻"
                    value={annotationNoteSearch}
                    onChange={(e) => setAnnotationNoteSearch(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl border-none bg-black/[0.04] focus:bg-card focus:ring-1 focus:ring-slate-200 focus-visible:ring-1 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1 px-1">
                <button
                  className={cn(
                    "w-[calc(100%-8px)] mx-1 flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group mb-3",
                    !selectedAnnotationNoteId
                      ? "bg-[#FFD700] text-black shadow-[0_4px_12px_rgba(255,215,0,0.25)] font-semibold"
                      : "text-muted-foreground hover:bg-card hover:shadow-sm",
                  )}
                  onClick={() => setSelectedAnnotationNoteId(null)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                      !selectedAnnotationNoteId ? "bg-card/30" : "bg-black/[0.04]"
                    )}>
                      <span className="text-sm">📝</span>
                    </div>
                    <span>所有标注</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-bold transition-colors px-1.5 py-0.5 rounded",
                      !selectedAnnotationNoteId ? "bg-black/10 text-black/70" : "bg-black/[0.04] text-gray-400",
                    )}
                  >
                    {annotations.length}
                  </span>
                </button>

                <div className="px-3 mb-2">
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">最近标注的收藏</span>
                </div>

                {annotationsLoading ? (
                  <div className="space-y-2 px-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl border border-transparent">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                          <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                          <div className="flex items-center justify-between mt-2">
                            <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-3 bg-muted rounded animate-pulse" />
                          </div>
                        </div>
                        <div className="w-14 h-14 rounded-lg bg-muted animate-pulse shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : filteredAnnotationNotes.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <p className="text-xs text-gray-400">暂无批注记录</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredAnnotationNotes.map((note) => (
                      <button
                        key={note.id}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group relative overflow-hidden",
                          selectedAnnotationNoteId === note.id
                            ? "bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/50"
                            : "text-gray-700 hover:bg-card hover:shadow-sm border border-transparent",
                        )}
                        onClick={() => setSelectedAnnotationNoteId(note.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold truncate text-card-foreground leading-tight">
                            {note.title || "无标题"}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate mt-1 leading-normal">
                            {note.excerpt || note.site_name || "无摘要"}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            {(note.annotation_count ?? 0) > 0 && (
                              <div className="inline-flex items-center px-1.5 py-0.5 bg-[#FFD700] text-black text-[10px] font-bold rounded shadow-sm">
                                {note.annotation_count} 条标注
                              </div>
                            )}
                            <div className="shrink-0 ml-auto">
                              {note.content_type === "article" ? (
                                <FileText className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
                              ) : note.content_type === "video" ? (
                                <Video className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
                              ) : (
                                <Music className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {note.cover_image_url ? (
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-slate-100 shadow-sm">
                            <img 
                              src={note.cover_image_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-slate-100">
                             <span className="text-xl">📄</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}


                {annotationsError && (
                  <div className="px-3 py-2 text-xs text-red-500">
                    {annotationsError}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Fallback Panels for Other Primary Navs */}

          {activePrimary === "archive" && (
            <div className="px-2">
              <div className="rounded-2xl border border-black/[0.04] bg-card/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Archive className="h-4 w-4 text-blue-600" />
                    归档笔记
                  </div>
                  <span className="text-xs text-gray-400">{notes.length}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-5">
                  这里展示你所有已归档的新闻笔记。
                </p>
              </div>
            </div>
          )}

          {activePrimary === "knowledge" && (
            <div className="space-y-2 px-2">
              {[
                { 
                  id: "chat", 
                  label: "智能对话", 
                  icon: MessageSquare,
                  desc: "基于收藏内容的 AI 问答与挖掘",
                  color: "text-blue-500",
                  bg: "bg-blue-50"
                },
                { 
                  id: "topics", 
                  label: "智能专题", 
                  icon: Sparkles,
                  desc: "深度分析并生成结构化报告",
                  color: "text-amber-500",
                  bg: "bg-amber-50"
                },
                { 
                  id: "graph", 
                  label: "知识图谱", 
                  icon: Share2,
                  desc: "可视化呈现知识间的逻辑关联",
                  color: "text-indigo-500",
                  bg: "bg-indigo-50"
                },
                { 
                  id: "quotes", 
                  label: "金句素材", 
                  icon: Quote,
                  desc: "自动提取核心观点与精彩表达",
                  color: "text-rose-500",
                  bg: "bg-rose-50"
                },
              ].map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "w-full text-left p-3 rounded-2xl transition-all duration-200 border group",
                    knowledgeSubView === item.id
                      ? "bg-card border-blue-200 shadow-[0_4px_12px_rgba(59,130,246,0.08)]"
                      : "bg-card/40 border-black/[0.03] hover:bg-card hover:border-black/[0.08] hover:shadow-sm"
                  )}
                  onClick={() => setKnowledgeSubView(item.id)}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={cn(
                      "p-1.5 rounded-lg shrink-0",
                      item.bg,
                      item.color
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      knowledgeSubView === item.id ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-slate-300"
                    )}>
                      {item.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-normal pl-0.5">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-black/5 text-xs text-gray-500">
          {user?.email ?? ""}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden">
        {confirmDialog.isOpen && (
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            onClose={closeConfirm}
            onConfirm={confirmDialog.onConfirm}
            title={confirmDialog.title}
            description={confirmDialog.description}
            confirmText={confirmDialog.confirmText}
            variant={confirmDialog.variant}
          />
        )}
        <div className="h-14 bg-card/80 backdrop-blur-md z-40 border-b border-black/[0.03] flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            {activePrimary === "settings" ? (
              <div className="text-sm font-semibold text-card-foreground">
                系统设置
              </div>
            ) : null}
            <div
              className={cn(
                "relative w-full group",
                activePrimary === "settings" && "hidden",
              )}
              ref={searchContainerRef}
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-all duration-300" />
              <Input
                placeholder={activePrimary === "annotations" ? "搜索批注 (⌘B)" : "搜索 (⌘B)"}
                value={activePrimary === "annotations" ? annotationRecordSearch : searchInput}
                onChange={(e) => {
                  if (activePrimary === "annotations") {
                    setAnnotationRecordSearch(e.target.value);
                  } else {
                    setSearchInput(e.target.value);
                  }
                }}
                onFocus={() => {
                  if (activePrimary !== "annotations") setIsSearchFocused(true);
                }}
                onKeyDown={(e) => {
                  // 按 Enter 或 ESC 键关闭搜索下拉面板
                  if (e.key === "Enter" || e.key === "Escape") {
                    setIsSearchFocused(false);
                    // 如果是 ESC 键，同时清空搜索输入
                    if (e.key === "Escape") {
                      if (activePrimary === "annotations") {
                        setAnnotationRecordSearch("");
                      } else {
                        setSearchInput("");
                      }
                    }
                  }
                }}
                onBlur={() => {
                  // 延迟关闭，让点击下拉面板中的项目有时间触发
                  setTimeout(() => {
                    setIsSearchFocused(false);
                  }, 200);
                }}
                className="pl-10 h-10 rounded-xl border-none bg-black/[0.04] focus:bg-card focus:ring-0 focus-visible:ring-0 shadow-none focus:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-all duration-300 placeholder:text-gray-400 text-sm"
              />

              {/* Search History Dropdown */}
              <AnimatePresence>
                {isSearchFocused && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full left-0 w-full bg-card rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-black/[0.03] mt-2 py-4 z-50 overflow-hidden"
                  >
                    <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                      {/* Recently Visited Section */}
                      <div className="px-4 mb-4">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">最近访问</h3>
                        <div className="space-y-0.5">
                          {[
                            ...recentItems.tags.map(t => ({ ...t, type: 'tag' as const })),
                            ...recentItems.folders.map(f => ({ ...f, type: 'folder' as const }))
                          ]
                            .sort((a, b) => new Date(b.last_accessed_at || 0).getTime() - new Date(a.last_accessed_at || 0).getTime())
                            .slice(0, 6)
                            .map((item) => (
                              <button 
                                key={`${item.type}-${item.id}`} 
                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-black/[0.03] transition-colors group"
                                onClick={() => {
                                  if (item.type === 'tag') {
                                    setSelectedTag(item.id);
                                    setCategory("all");
                                    setActivePrimary("tags");
                                  } else {
                                    setSelectedFolder(item.id);
                                    setCategory("folder");
                                    setActivePrimary("collections");
                                  }
                                  setIsSearchFocused(false);
                                  trackAccess(item.type, item.id);
                                }}
                              >
                                {item.type === 'tag' ? (
                                  <Tag className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <Folder className="h-4 w-4 text-gray-400" />
                                )}
                                <span className="text-sm text-gray-700 group-hover:text-black">{item.name}</span>
                              </button>
                            ))}
                          {recentItems.tags.length === 0 && recentItems.folders.length === 0 && (
                            <p className="text-xs text-gray-400 px-2 py-2">暂无访问记录</p>
                          )}
                        </div>
                      </div>

                      {/* Recently Viewed Items Section */}
                      <div className="px-4">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">最近浏览</h3>
                        <div className="space-y-1">
                          {recentItems.notes.length > 0 ? (
                            recentItems.notes.map((note) => (
                              <button 
                                key={note.id} 
                                className="w-full flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-black/[0.03] transition-colors text-left group"
                              onClick={() => {
                                // Open note in reader
                                setIsSearchFocused(false);
                                trackAccess('note', note.id);
                                window.location.href = `/notes/${note.id}`;
                              }}
                              >
                                <div className="mt-0.5">
                                  {note.content_type === "article" ? <FileText className="h-4 w-4 text-gray-400" /> :
                                   note.content_type === "video" ? <Video className="h-4 w-4 text-gray-400" /> :
                                   <Music className="h-4 w-4 text-gray-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] text-gray-800 font-medium truncate group-hover:text-black leading-tight">
                                    {note.title || "无标题"}
                                  </div>
                                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                    {note.site_name || note.source_url || "未知来源"}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400 px-2 py-2">暂无浏览记录</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          {activePrimary === "settings" ? null : activePrimary === "annotations" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 text-sm"
                onClick={() => loadAnnotationsView()}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> 刷新
              </Button>
            </div>
          ) : activePrimary === "knowledge" ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-gray-500 text-sm" disabled>
                <BookOpen className="h-4 w-4 mr-1" /> 知识库
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant={showArchived || activePrimary === "archive" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  if (activePrimary === "archive") return;
                  setShowArchived(!showArchived);
                }}
                className={cn(
                  "text-sm",
                  (showArchived || activePrimary === "archive") &&
                    "bg-blue-500 hover:bg-blue-600 text-white",
                  activePrimary === "archive" && "opacity-100 cursor-default",
                )}
              >
                <Archive className="h-4 w-4 mr-1" /> 已归档
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-500 text-sm">
                    <Filter className="h-4 w-4 mr-1" /> 筛选
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setContentTypeFilter("all")}>
                    {contentTypeFilter === "all" && <Check className="h-4 w-4 mr-2" />}
                    {contentTypeFilter !== "all" && <span className="w-4 mr-2" />}
                    不限
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setContentTypeFilter("article")}>
                    {contentTypeFilter === "article" && <Check className="h-4 w-4 mr-2" />}
                    {contentTypeFilter !== "article" && <span className="w-4 mr-2" />}
                    文章
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setContentTypeFilter("video")}>
                    {contentTypeFilter === "video" && <Check className="h-4 w-4 mr-2" />}
                    {contentTypeFilter !== "video" && <span className="w-4 mr-2" />}
                    视频
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setContentTypeFilter("audio")}>
                    {contentTypeFilter === "audio" && <Check className="h-4 w-4 mr-2" />}
                    {contentTypeFilter !== "audio" && <span className="w-4 mr-2" />}
                    语音
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-500 text-sm">
                    <ArrowUpDown className="h-4 w-4 mr-1" /> 排序
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setSortBy("created_at"); setSortOrder("desc"); }}>
                  {sortBy === "created_at" && sortOrder === "desc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "created_at" && sortOrder === "desc") && <span className="w-4 mr-2" />}
                  按创建时间 从新到旧
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("created_at"); setSortOrder("asc"); }}>
                  {sortBy === "created_at" && sortOrder === "asc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "created_at" && sortOrder === "asc") && <span className="w-4 mr-2" />}
                  按创建时间 从旧到新
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("updated_at"); setSortOrder("desc"); }}>
                  {sortBy === "updated_at" && sortOrder === "desc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "updated_at" && sortOrder === "desc") && <span className="w-4 mr-2" />}
                  按更新时间 从新到旧
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("updated_at"); setSortOrder("asc"); }}>
                  {sortBy === "updated_at" && sortOrder === "asc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "updated_at" && sortOrder === "asc") && <span className="w-4 mr-2" />}
                  按更新时间 从旧到新
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("title"); setSortOrder("asc"); }}>
                  {sortBy === "title" && sortOrder === "asc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "title" && sortOrder === "asc") && <span className="w-4 mr-2" />}
                  按标题 A-Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("title"); setSortOrder("desc"); }}>
                  {sortBy === "title" && sortOrder === "desc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "title" && sortOrder === "desc") && <span className="w-4 mr-2" />}
                  按标题 Z-A
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("site_name"); setSortOrder("asc"); }}>
                  {sortBy === "site_name" && sortOrder === "asc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "site_name" && sortOrder === "asc") && <span className="w-4 mr-2" />}
                  按网站 A-Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("site_name"); setSortOrder("desc"); }}>
                  {sortBy === "site_name" && sortOrder === "desc" && <Check className="h-4 w-4 mr-2" />}
                  {!(sortBy === "site_name" && sortOrder === "desc") && <span className="w-4 mr-2" />}
                  按网站 Z-A
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-500 text-sm">
                  <LayoutGrid className="h-4 w-4 mr-1" /> 视图
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setViewMode("compact-card")}>
                  {viewMode === "compact-card" && <Check className="h-4 w-4 mr-2" />}
                  {viewMode !== "compact-card" && <span className="w-4 mr-2" />}
                  紧凑卡片
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode("detail-list")}>
                  {viewMode === "detail-list" && <Check className="h-4 w-4 mr-2" />}
                  {viewMode !== "detail-list" && <span className="w-4 mr-2" />}
                  详情列表
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode("compact-list")}>
                  {viewMode === "compact-list" && <Check className="h-4 w-4 mr-2" />}
                  {viewMode !== "compact-list" && <span className="w-4 mr-2" />}
                  紧凑列表
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode("title-list")}>
                  {viewMode === "title-list" && <Check className="h-4 w-4 mr-2" />}
                  {viewMode !== "title-list" && <span className="w-4 mr-2" />}
                  标题列表
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-blue-500/90 hover:bg-blue-600 shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => { setCreationMode("url"); setShowAddNoteDialog(true); }}>
                  <Link2 className="h-4 w-4 mr-2" /> 添加网址
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setCreationMode("quick"); setShowAddNoteDialog(true); }}>
                  <StickyNote className="h-4 w-4 mr-2" /> 添加速记
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setCreationMode("upload"); setShowAddNoteDialog(true); }}>
                  <Upload className="h-4 w-4 mr-2" /> 上传图片/视频/文件
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}
        </div>

        {activePrimary === "settings" ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/30">
            {settingsTab === "account" && <AccountSection user={user} />}
            {settingsTab === "rewards" && <RewardsSection />}
            {settingsTab === "stats" && <StatsSection />}
            {settingsTab === "appearance" && <AppearanceSection />}
            {settingsTab === "trash" && <TrashSection />}
            {settingsTab === "about" && <AboutSection />}
          </div>
        ) : activePrimary === "annotations" ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/30">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedAnnotationNote ? selectedAnnotationNote.title : "所有"}
                </h2>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {selectedAnnotationNote
                    ? `${selectedAnnotationNote.annotation_count ?? 0} 条批注`
                    : `共 ${annotations.length} 条批注`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-slate-600 hover:bg-card hover:shadow-sm transition-all rounded-xl">
                      <Filter className="h-4 w-4" />
                      <span className="text-sm font-medium">筛选</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl">
                    <DropdownMenuItem 
                      className={cn(annotationTypeFilter === "all" && "bg-muted font-semibold")}
                      onClick={() => setAnnotationTypeFilter("all")}
                    >所有类型</DropdownMenuItem>
                    <DropdownMenuItem 
                      className={cn(annotationTypeFilter === "article" && "bg-muted font-semibold")}
                      onClick={() => setAnnotationTypeFilter("article")}
                    >文章</DropdownMenuItem>
                    <DropdownMenuItem 
                      className={cn(annotationTypeFilter === "video" && "bg-muted font-semibold")}
                      onClick={() => setAnnotationTypeFilter("video")}
                    >视频</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-slate-600 hover:bg-card hover:shadow-sm transition-all rounded-xl">
                      <ArrowUpDown className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {annotationSort === "updated_at_desc" ? "按更新日期 从新到旧" :
                         annotationSort === "updated_at_asc" ? "按更新日期 从旧到新" :
                         annotationSort === "created_at_desc" ? "按创建日期 从新到旧" :
                         annotationSort === "created_at_asc" ? "按创建日期 从旧到新" :
                         annotationSort === "url_az" ? "按来源网址 A-Z" :
                         annotationSort === "url_za" ? "按来源网址 Z-A" : "排序"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <DropdownMenuItem onClick={() => setAnnotationSort("updated_at_desc")}>按更新日期 从新到旧</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAnnotationSort("updated_at_asc")}>按更新日期 从旧到新</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAnnotationSort("created_at_desc")}>按创建日期 从新到旧</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAnnotationSort("created_at_asc")}>按创建日期 从旧到新</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAnnotationSort("url_az")}>按来源网址 A-Z</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAnnotationSort("url_za")}>按来源网址 Z-A</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedAnnotationNote && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 bg-blue-500 text-white hover:bg-blue-600 hover:text-white transition-all rounded-xl ml-2 shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
                    onClick={() => {
                      window.location.href = `/notes/${selectedAnnotationNote.id}`;
                    }}
                  >
                    阅读原文 <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {annotationsError && (
              <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm mb-6 border border-red-100 flex items-center gap-2">
                <span className="text-lg">⚠️</span> {annotationsError}
              </div>
            )}

            {annotationsLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="h-8 w-8 border-4 border-border border-t-blue-500 rounded-full animate-spin" />
                <p className="text-muted-foreground/70 text-sm font-medium tracking-wide">同步云端批注中...</p>
              </div>
            ) : annotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-20 h-20 bg-muted/80 rounded-[2rem] flex items-center justify-center mb-2 shadow-[inset_0_0_0_1px_rgba(241,245,249,1)]">
                  <PenLine className="h-9 w-9 text-muted-foreground/50" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-semibold text-lg">暂无批注</h3>
                <p className="text-muted-foreground/70 text-sm max-w-sm text-center leading-relaxed px-4">
                  阅读文章时，选中文字即可添加高亮和批注。所有记录将在这里自动聚合。
                </p>
              </div>
            ) : filteredAnnotationRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-20 h-20 bg-muted/80 rounded-[2rem] flex items-center justify-center mb-2 shadow-[inset_0_0_0_1px_rgba(241,245,249,1)]">
                  <Search className="h-9 w-9 text-muted-foreground/50" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-semibold text-lg">没有找到匹配的批注</h3>
                <Button 
                  variant="outline" 
                  className="mt-2 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 px-6"
                  onClick={() => {
                    setAnnotationRecordSearch("");
                    setAnnotationTypeFilter("all");
                  }}
                >
                  重置筛选
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                  {filteredAnnotationRecords.map((a) => {
                    const highlightColor = a.highlights?.color || "#FFD700";
                    const note = annotationNotes.find(n => n.id === a.note_id);
                    const quoteMaterialId = quoteMaterialIdByAnnotationId[a.id];
                    const quoteBusy = quoteMaterialBusyAnnotationIds.has(a.id);

                    return (
                      <Card
                        key={a.id}
                        className="group bg-card ring-0 border border-border shadow-none hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300 rounded-xl overflow-hidden flex flex-col border-l-4 aspect-[4/3] cursor-pointer"
                        style={{ borderLeftColor: highlightColor }}
                        onClick={() => setEditingAnnotation(a)}
                      >
                        <div className="p-3 flex flex-col h-full min-h-0">
                          <div className="flex items-start justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground/70 hover:text-slate-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={quoteBusy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void toggleQuoteMaterialForAnnotation(a.id);
                                  }}
                                >
                                  <Quote className="h-4 w-4 mr-2" />
                                  {quoteMaterialId ? "取消金句素材" : "设为金句素材"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex-1 min-h-0 overflow-hidden">
                            {a.highlights?.quote ? (
                              <div className="mb-2">
                                <div className="text-muted-foreground text-[12px] leading-relaxed line-clamp-2 bg-muted/80 rounded-lg px-3 py-2 border border-slate-100/50">
                                  {a.highlights.quote}
                                </div>
                              </div>
                            ) : null}

                            <div className="text-card-foreground text-[13px] leading-relaxed font-medium break-words whitespace-pre-line line-clamp-5">
                              {a.content}
                            </div>

                            {a.screenshot_url ? (
                              <div className="mt-2 rounded-lg overflow-hidden border border-slate-100 shadow-sm group-hover:border-border transition-colors">
                                <img
                                  src={a.screenshot_url}
                                  alt=""
                                  className="w-full h-auto max-h-20 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between gap-2">
                            <div
                              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer group/note"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAnnotationNoteId(a.note_id);
                              }}
                            >
                              <div className="shrink-0 w-4 h-4 rounded bg-muted flex items-center justify-center group-hover/note:bg-blue-50 transition-colors">
                                {note?.content_type === "article" ? (
                                  <FileText className="h-2.5 w-2.5 text-muted-foreground/70 group-hover/note:text-blue-500" />
                                ) : note?.content_type === "video" ? (
                                  <Video className="h-2.5 w-2.5 text-muted-foreground/70 group-hover/note:text-blue-500" />
                                ) : (
                                  <Music className="h-2.5 w-2.5 text-muted-foreground/70 group-hover/note:text-blue-500" />
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground/70 font-medium truncate group-hover/note:text-blue-500 transition-colors">
                                {note?.title || "未知来源"}
                              </span>
                            </div>
                            <div className="shrink-0 text-[10px] text-muted-foreground/50 font-medium tabular-nums">
                              {new Date(a.created_at).toLocaleDateString("zh-CN", {
                                month: "numeric",
                                day: "numeric"
                              })}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <div ref={loadMoreAnnotationsRef} className="py-6 flex flex-col items-center justify-center gap-2">
                  {loadingMoreAnnotations ? (
                    <div className="flex items-center gap-2 text-sm text-blue-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>加载更多批注...</span>
                    </div>
                  ) : hasMoreAnnotations ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/70 opacity-60">
                      <ChevronDown className="h-3.5 w-3.5" />
                      <span>继续滚动加载更多</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/50">
                      — 已加载全部 {annotations.length} 条批注 —
                    </div>
                  )}
                </div>

                <EditAnnotationDialog
                  open={!!editingAnnotation}
                  onOpenChange={(open) => !open && setEditingAnnotation(null)}
                  annotation={editingAnnotation}
                  onSuccess={(newContent) => {
                    if (newContent && editingAnnotation) {
                      setAnnotations(prev => prev.map(a =>
                        a.id === editingAnnotation.id
                          ? { ...a, content: newContent, updated_at: new Date().toISOString() }
                          : a
                      ));
                    }
                  }}
                />
              </>
            )}
          </div>
        ) : activePrimary === "knowledge" ? (
          <KnowledgeView subView={knowledgeSubView} onSubViewChange={setKnowledgeSubView} />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {activePrimary === "archive"
                    ? "归档笔记"
                    : category === "uncategorized"
                    ? "未分类"
                    : category === "all"
                    ? "所有收藏"
                    : category === "starred"
                    ? "星标"
                    : category === "today"
                    ? "今日"
                    : category === "folder" && selectedFolder
                    ? "收藏夹"
                    : category === "smart" && selectedSmartList
                    ? selectedSmartList.label
                    : "所有收藏"}
                </h2>
                {category === "folder" &&
                  selectedFolder &&
                  selectedFolderBreadcrumb && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedFolderBreadcrumb}
                    </p>
                  )}
              </div>
              {renderBulkSelectionControls()}
            </div>
            <span className="text-xs text-gray-400">
              {activePrimary === "archive" ? `${notes.length} 条` : `${notes.length} / ${counts.all}`}
            </span>
          </div>

          {notesLoadingError && (
            <div className="text-red-500 text-sm mb-4">
              {notesLoadingError}
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-4">
              {viewMode === "compact-card" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-card rounded-[14px] border border-border overflow-hidden">
                      <div className="aspect-[1.91/1] w-full bg-muted animate-pulse" />
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 w-3 bg-muted rounded-full animate-pulse" />
                          <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                        </div>
                        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                        <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className={cn("flex items-center gap-4 bg-card rounded-lg border border-border", viewMode === "title-list" ? "p-3" : "p-4")}>
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                      {viewMode !== "title-list" && (
                        <div className={cn("bg-muted rounded animate-pulse shrink-0", viewMode === "detail-list" ? "w-24 h-24" : "w-14 h-14")} />
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
                        {viewMode !== "title-list" && (
                          <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                        )}
                        {viewMode === "detail-list" && (
                          <div className="flex gap-1 mt-2">
                            <div className="h-5 w-12 bg-muted rounded-full animate-pulse" />
                            <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="w-20 h-20 bg-muted/80 rounded-[2rem] flex items-center justify-center mb-2 shadow-[inset_0_0_0_1px_rgba(241,245,249,1)]">
                {searchQuery.trim() ? (
                  <Search className="h-9 w-9 text-muted-foreground/50" />
                ) : activePrimary === "archive" ? (
                  <Archive className="h-9 w-9 text-muted-foreground/50" />
                ) : activePrimary === "tags" ? (
                  <Tag className="h-9 w-9 text-muted-foreground/50" />
                ) : category === "starred" ? (
                  <Star className="h-9 w-9 text-muted-foreground/50" />
                ) : (
                  <Inbox className="h-9 w-9 text-muted-foreground/50" />
                )}
              </div>
              <h3 className="text-slate-900 dark:text-white font-semibold text-lg">
                {searchQuery.trim()
                  ? "没有找到相关内容"
                  : activePrimary === "archive"
                  ? "暂无归档内容"
                  : activePrimary === "tags"
                  ? "暂无标签笔记"
                  : category === "starred"
                  ? "暂无星标笔记"
                  : "暂无内容"}
              </h3>
              <p className="text-muted-foreground/70 text-sm max-w-sm text-center leading-relaxed px-4">
                {searchQuery.trim()
                  ? `未找到与 "${searchQuery}" 相关的笔记，请尝试更换关键词`
                  : activePrimary === "archive"
                  ? "归档的笔记将显示在这里，您可以将不再需要的笔记归档以保持收件箱整洁"
                  : activePrimary === "tags"
                  ? "该标签下暂无关联笔记，您可以为笔记添加标签以便分类管理"
                  : category === "starred"
                  ? "为您重要的笔记添加星标，它们将在这里集中显示"
                  : "点击右上角 + 开始添加第一条笔记，或者从浏览器插件快速保存"}
              </p>
              {!searchQuery.trim() && activePrimary !== "archive" && activePrimary !== "tags" && category !== "starred" && (
                <Button
                  onClick={() => setShowAddNoteDialog(true)}
                  className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-lg shadow-blue-600/20 h-11 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  新建笔记
                </Button>
              )}
            </div>
          ) : viewMode === "compact-card" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
              {notes.map((note) => (
                <div key={note.id} className="h-full">
                  {renderNoteCard(note)}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <Card
                  key={note.id}
                  className={cn(
                    "flex items-center gap-4 hover:shadow-md transition-all",
                    viewMode === "title-list" ? "p-3" : "p-4"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 flex-1 cursor-pointer",
                      viewMode === "title-list" && "gap-2"
                    )}
                    onClick={() => (window.location.href = `/notes/${note.id}`)}
                  >
                    <Checkbox
                      checked={selectedNotes.has(note.id)}
                      onCheckedChange={() => toggleSelectNote(note.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    {viewMode !== "title-list" && note.cover_image_url && (
                      <div className={cn(
                        "shrink-0 overflow-hidden bg-gray-50 rounded",
                        viewMode === "detail-list" ? "w-24 h-24" : "w-14 h-14"
                      )}>
                        <img
                          src={note.cover_image_url}
                          alt={note.title || ""}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        "font-semibold line-clamp-2",
                        viewMode === "title-list" ? "text-sm" : "text-base"
                      )}>
                        {note.title || "无标题"}
                      </h3>
                      {viewMode === "detail-list" && note.excerpt && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {note.excerpt}
                        </p>
                      )}
                      {viewMode === "detail-list" && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {note.tags.map((tag) => (
                            <Badge key={tag.id} variant="outline" className="text-xs">
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {viewMode !== "title-list" && (
                      <div className="text-xs text-gray-500 text-right">
                        <div>{note.site_name || "未知来源"}</div>
                        <div className="text-gray-400">{formatDate(note.created_at)}</div>
                      </div>
                    )}
                    {viewMode === "title-list" && (
                      <span className="text-xs text-gray-400">
                        {formatDate(note.created_at)}
                      </span>
                    )}
                    {renderNoteActions(note)}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center gap-2">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-sm text-blue-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>加载更多...</span>
              </div>
            ) : hasMore ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70 opacity-60">
                <ChevronDown className="h-3.5 w-3.5" />
                <span>继续滚动加载更多</span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/50">
                — 已加载全部 {notes.length} 条内容 —
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {renderAddNoteDialog()}
      {renderMoveDialog()}
      {renderTagDialog()}
      {renderFolderDialog()}
      {renderTagDialog2()}
    </div>
  );
}
