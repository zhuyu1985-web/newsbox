"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Archive,
  BookOpen,
  Check,
  Copy,
  Download,
  List,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Video,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Volume2,
  ExternalLink,
  FileDown,
  LineChart,
  Zap,
} from "lucide-react";
import { TopicManagementView } from "./smart-topics/TopicManagementView";
import { KnowledgeGraphView } from "./knowledge-graph/KnowledgeGraphView";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

type SubView = "chat" | "topics" | "graph" | "quotes";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string | null;
  rating?: number | null;
};

type NoteMeta = {
  id: string;
  title: string | null;
  source_url: string | null;
  site_name: string | null;
};

type QuoteMaterialItem = {
  id: string;
  note_id: string;
  highlight_id: string | null;
  annotation_id: string | null;
  content: string;
  source_type: string;
  created_at: string;
  notes?: {
    title: string | null;
    source_url: string | null;
    site_name: string | null;
  } | null;
};

type Conversation = {
  id: string;
  title: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  updated_at: string;
  created_at: string;
  pinned?: boolean | null;
  pinned_at?: string | null;
};

type Topic = {
  id: string;
  title: string | null;
  keywords: string[] | null;
  summary_markdown: string | null;
  member_count: number | null;
  pinned?: boolean | null;
  pinned_at?: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
  last_ingested_at?: string | null;
  updated_at: string;
  created_at: string;
};

type TopicNote = {
  id: string;
  title: string | null;
  excerpt: string | null;
  site_name: string | null;
  source_url: string | null;
  published_at: string | null;
  created_at: string;
  content_type: "article" | "video" | "audio";
  cover_image_url: string | null;
};

type TopicMember = {
  noteId: string;
  score: number | null;
  time: string;
  source?: string | null;
  manual_state?: string | null;
  event_time?: string | null;
  event_fingerprint?: string | null;
  evidence_rank?: number | null;
  note: TopicNote;
};

type TopicEventNode = {
  id: string;
  event_time: string;
  title: string | null;
  summary: string | null;
  fingerprint: string;
  importance: number | null;
  evidence: TopicMember[];
};

type TopicDetail = {
  topic: Topic;
  members: TopicMember[];
  timeline: TopicMember[];
  events?: TopicEventNode[];
};

function extractCitedNoteIds(text: string) {
  const ids = new Set<string>();
  const re = /\[note:([0-9a-fA-F-]{36})\]/g;
  for (const m of text.matchAll(re)) {
    if (m[1]) ids.add(m[1]);
  }
  return Array.from(ids);
}

function toPreview(text: string, maxLen = 120) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function formatDay(date: string) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

function isTopicNew(lastIngestedAt?: string | null) {
  if (!lastIngestedAt) return false;
  const d = new Date(lastIngestedAt);
  if (!Number.isFinite(d.getTime())) return false;
  // 近 72 小时内有新增成员，显示 New
  return Date.now() - d.getTime() < 72 * 60 * 60 * 1000;
}

function isDirectVideoUrl(url: string) {
  const u = (url || "").trim().toLowerCase();
  return u.endsWith(".mp4") || u.endsWith(".m3u8") || u.includes("supabase.co/storage") || u.includes("storage.googleapis.com");
}

function toVideoPreviewUrl(rawUrl: string): { url: string; kind: "iframe" | "direct" } {
  const input = (rawUrl || "").trim();
  if (!input) return { url: "", kind: "iframe" };
  if (isDirectVideoUrl(input)) return { url: input, kind: "direct" };

  try {
    const u = new URL(input);

    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const vid = u.searchParams.get("v");
      if (vid) return { url: `https://www.youtube.com/embed/${vid}`, kind: "iframe" };
      if (u.pathname.startsWith("/embed/")) return { url: input, kind: "iframe" };
    }
    if (u.hostname === "youtu.be") {
      const vid = u.pathname.replace("/", "").trim();
      if (vid) return { url: `https://www.youtube.com/embed/${vid}`, kind: "iframe" };
    }

    // Bilibili
    if (u.hostname.includes("bilibili.com")) {
      if (u.hostname.includes("player.bilibili.com")) return { url: input, kind: "iframe" };
      const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/);
      if (m?.[1]) {
        return {
          url: `https://player.bilibili.com/player.html?bvid=${m[1]}&page=1&high_quality=1&autoplay=0`,
          kind: "iframe",
        };
      }
    }
  } catch {
    // ignore
  }

  // Fallback: try iframe directly
  return { url: input, kind: "iframe" };
}

export function KnowledgeView({
  className,
  subView = "chat",
  onSubViewChange,
}: {
  className?: string;
  subView?: string;
  onSubViewChange?: (view: string) => void;
}) {
  console.log("KnowledgeView subView:", subView);
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);

  // --- chat state ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);
  const [showRegenerateConfirmId, setShowRegenerateConfirmId] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  // --- conversation actions ---
  const [conversationActionBusyId, setConversationActionBusyId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);

  // --- message actions ---
  const [messageActionBusyId, setMessageActionBusyId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [exportingMarkdown, setExportingMarkdown] = useState(false);

  // --- topics state ---
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingTopicDetail, setLoadingTopicDetail] = useState(false);
  const [rebuildingTopics, setRebuildingTopics] = useState(false);
  const [topicActionBusyId, setTopicActionBusyId] = useState<string | null>(null);
  const [showArchivedTopics, setShowArchivedTopics] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceTopicId, setMergeSourceTopicId] = useState<string | null>(null);

  // --- quote materials state ---
  const [quoteMaterials, setQuoteMaterials] = useState<QuoteMaterialItem[]>([]);
  const [quoteMaterialsLoading, setQuoteMaterialsLoading] = useState(false);
  const [quoteMaterialsError, setQuoteMaterialsError] = useState<string | null>(null);
  const [quoteMaterialsQuery, setQuoteMaterialsQuery] = useState("");
  const [quoteMaterialsPage, setQuoteMaterialsPage] = useState(1);
  const [quoteMaterialsHasMore, setQuoteMaterialsHasMore] = useState(false);

  // drag-to-merge
  const [draggingTopicId, setDraggingTopicId] = useState<string | null>(null);
  const [dragOverTopicId, setDragOverTopicId] = useState<string | null>(null);
  const [dragMergeDialogOpen, setDragMergeDialogOpen] = useState(false);
  const [dragMergeSourceTopicId, setDragMergeSourceTopicId] = useState<string | null>(null);
  const [dragMergeTargetTopicId, setDragMergeTargetTopicId] = useState<string | null>(null);

  // video preview
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoPreview, setVideoPreview] = useState<{ title: string; url: string; kind: "iframe" | "direct" } | null>(null);

  // member actions: add to other topic
  const [addToTopicDialogOpen, setAddToTopicDialogOpen] = useState(false);
  const [addToTopicNoteId, setAddToTopicNoteId] = useState<string | null>(null);
  const [addToTopicTargetTopicId, setAddToTopicTargetTopicId] = useState<string | null>(null);

  // member actions: correct event time
  const [correctTimeDialogOpen, setCorrectTimeDialogOpen] = useState(false);
  const [correctTimeTopicId, setCorrectTimeTopicId] = useState<string | null>(null);
  const [correctTimeNoteId, setCorrectTimeNoteId] = useState<string | null>(null);
  const [correctTimeValue, setCorrectTimeValue] = useState("");

  const [contextMenu, setContextMenu] = useState<
    | {
        x: number;
        y: number;
        topicId: string;
        noteId: string;
        note: TopicNote;
        timeIso?: string | null;
      }
    | null
  >(null);

  // --- common state ---
  const [uiError, setUiError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const autoScrollEnabledRef = useRef(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // chat history paging
  const PAGE_SIZE = 60;
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const hasMoreHistoryByConvRef = useRef<Record<string, boolean>>({});
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const loadingOlderMessagesRef = useRef(false);
  const lastMessagesMutationRef = useRef<"append" | "prepend" | "reset" | null>(null);

  // 防止切换会话/并发请求导致的状态错乱
  const activeConversationIdRef = useRef<string | null>(null);
  const loadMessagesReqIdRef = useRef(0);

  // 会话消息缓存：切换时先秒开缓存，再后台同步最新
  const messagesCacheRef = useRef<Record<string, ChatMessage[]>>({});

  // Note meta cache
  const [noteMetaMap, setNoteMetaMap] = useState<Record<string, NoteMeta>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!contextMenu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu]);

  const ensureNoteMeta = useCallback(
    async (noteIds: string[]) => {
      const missing = noteIds.filter((id) => !noteMetaMap[id]);
      if (missing.length === 0) return;

      const { data } = await supabase.from("notes").select("id, title, source_url, site_name").in("id", missing);
      if (data) {
        const next = { ...noteMetaMap };
        for (const n of data) next[n.id] = n as NoteMeta;
        setNoteMetaMap(next);
      }
    },
    [supabase, noteMetaMap],
  );

  const loadConversations = useCallback(async () => {
    if (!userId) return;
    setLoadingConversations(true);

    const base = supabase.from("knowledge_conversations").select("*").eq("user_id", userId);

    const run = async (withPin: boolean) => {
      if (withPin) {
        return await base
          .order("pinned", { ascending: false })
          .order("pinned_at", { ascending: false })
          .order("updated_at", { ascending: false });
      }

      return await base.order("updated_at", { ascending: false });
    };

    let data: any[] | null = null;
    let error: any = null;

    const res1 = await run(true);
    data = res1.data as any[] | null;
    error = res1.error;

    // 兼容：旧库可能还没跑到置顶字段的迁移，避免直接报错导致列表不可用
    if (error && typeof error.message === "string" && error.message.includes("pinned")) {
      const res2 = await run(false);
      data = res2.data as any[] | null;
      error = res2.error;
    }

    if (error) {
      setUiError(`加载对话失败：${error.message}`);
    } else {
      setConversations((data ?? []) as Conversation[]);
      if (data && data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
    }

    setLoadingConversations(false);
  }, [userId, supabase, activeConversationId]);

  useEffect(() => {
    if (userId && subView === "chat") void loadConversations();
  }, [userId, subView, loadConversations]);

  const loadQuoteMaterials = useCallback(
    async (args?: { page?: number; append?: boolean }) => {
      const page = args?.page ?? 1;
      const append = args?.append ?? false;
      const q = quoteMaterialsQuery.trim();
      const limit = 50;

      setQuoteMaterialsLoading(true);
      setQuoteMaterialsError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (q) params.set("q", q);

        const res = await fetch(`/api/quote-materials?${params.toString()}`, { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json?.success) {
          setQuoteMaterialsError(json?.error || "加载金句素材失败");
          return;
        }

        const items = (Array.isArray(json.items) ? json.items : []) as QuoteMaterialItem[];
        setQuoteMaterials((prev) => (append ? [...prev, ...items] : items));
        setQuoteMaterialsPage(page);
        setQuoteMaterialsHasMore(items.length === limit);
      } catch (e) {
        setQuoteMaterialsError((e as Error)?.message || "加载金句素材失败");
      } finally {
        setQuoteMaterialsLoading(false);
      }
    },
    [quoteMaterialsQuery],
  );

  const deleteQuoteMaterial = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/quote-materials?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "删除失败");
        return;
      }
      setQuoteMaterials((prev) => prev.filter((it) => it.id !== id));
      toast.success("已删除");
    } catch (e) {
      toast.error((e as Error)?.message || "删除失败");
    }
  }, []);

  useEffect(() => {
    if (subView !== "quotes") return;
    const t = window.setTimeout(() => {
      void loadQuoteMaterials({ page: 1, append: false });
    }, 250);
    return () => window.clearTimeout(t);
  }, [subView, quoteMaterialsQuery, loadQuoteMaterials]);

  const loadMessages = useCallback(
    async (convId: string) => {
      const reqId = ++loadMessagesReqIdRef.current;
      setLoadingMessages(true);

      // 初次进入只加载最近一页（向上滚动再加载更早消息）
      const { data, error } = await supabase
        .from("knowledge_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      // 避免并发切换：只应用最后一次请求的结果
      if (reqId !== loadMessagesReqIdRef.current) return;

      if (error) {
        setUiError(`加载消息失败：${error.message}`);
      } else {
        const desc = (data ?? []) as ChatMessage[];
        const msgs = desc.slice().reverse();
        messagesCacheRef.current[convId] = msgs;

        const more = desc.length === PAGE_SIZE;
        hasMoreHistoryByConvRef.current[convId] = more;

        // 只有当前会话才更新屏幕上的 messages（否则会出现“切换后又被旧请求覆盖”的错觉）
        if (activeConversationIdRef.current === convId) {
          lastMessagesMutationRef.current = "reset";
          setMessages(msgs);
          setHasMoreHistory(more);

          // Fetch meta for all cited notes in all messages
          const allCited = new Set<string>();
          for (const m of msgs) {
            if (m.role === "assistant") {
              extractCitedNoteIds(m.content).forEach((id) => allCited.add(id));
            }
          }
          if (allCited.size > 0) void ensureNoteMeta(Array.from(allCited));

          autoScrollEnabledRef.current = true;
          setAutoScrollEnabled(true);
          scrollToBottom("auto");
        }
      }

      setLoadingMessages(false);
    },
    [supabase, ensureNoteMeta, PAGE_SIZE],
  );

  useEffect(() => {
    if (activeConversationId && subView === "chat") void loadMessages(activeConversationId);
  }, [activeConversationId, subView, loadMessages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollAreaRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  const prependMessagesPreserveScroll = useCallback(
    (older: ChatMessage[]) => {
      const el = scrollAreaRef.current;
      lastMessagesMutationRef.current = "prepend";

      if (!el) {
        setMessages((prev) => [...older, ...prev]);
        return;
      }

      const prevScrollTop = el.scrollTop;
      const prevScrollHeight = el.scrollHeight;

      setMessages((prev) => [...older, ...prev]);

      requestAnimationFrame(() => {
        const nextEl = scrollAreaRef.current;
        if (!nextEl) return;
        const nextScrollHeight = nextEl.scrollHeight;
        nextEl.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
      });
    },
    [],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId) return;
    if (!hasMoreHistory) return;
    if (loadingOlderMessagesRef.current) return;

    const oldest = messages[0]?.created_at;
    if (!oldest) {
      setHasMoreHistory(false);
      hasMoreHistoryByConvRef.current[activeConversationId] = false;
      return;
    }

    loadingOlderMessagesRef.current = true;
    setLoadingOlderMessages(true);

    try {
      const { data, error } = await supabase
        .from("knowledge_messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) {
        setUiError(`加载更早消息失败：${error.message}`);
        return;
      }

      const desc = (data ?? []) as ChatMessage[];
      const older = desc.slice().reverse();

      if (older.length > 0) {
        prependMessagesPreserveScroll(older);

        const cached = messagesCacheRef.current[activeConversationId] ?? messages;
        messagesCacheRef.current[activeConversationId] = [...older, ...cached];
      }

      const more = desc.length === PAGE_SIZE;
      setHasMoreHistory(more);
      hasMoreHistoryByConvRef.current[activeConversationId] = more;
    } finally {
      loadingOlderMessagesRef.current = false;
      setLoadingOlderMessages(false);
    }
  }, [activeConversationId, hasMoreHistory, messages, supabase, PAGE_SIZE, prependMessagesPreserveScroll]);

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;

    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    autoScrollEnabledRef.current = atBottom;
    setAutoScrollEnabled(atBottom);

    // auto-load older history when reaching the top
    if (scrollTop < 80 && hasMoreHistory && !loadingOlderMessagesRef.current) {
      void loadOlderMessages();
    }
  };

  useEffect(() => {
    if (subView !== "chat") return;

    // When we prepend history, keep the user's current viewport anchored.
    if (lastMessagesMutationRef.current === "prepend") {
      lastMessagesMutationRef.current = null;
      return;
    }

    if (autoScrollEnabledRef.current) scrollToBottom("smooth");
    lastMessagesMutationRef.current = null;
  }, [messages.length, subView]);

  const selectConversation = (id: string) => {
    // 立即响应：切换高亮 + 先展示缓存（若有），再后台同步最新
    if (id === activeConversationId) {
      setSidebarOpen(false);
      return;
    }

    setUiError(null);

    const cached = messagesCacheRef.current[id];
    const cachedHasMore = Boolean(hasMoreHistoryByConvRef.current[id]);

    lastMessagesMutationRef.current = "reset";
    autoScrollEnabledRef.current = true;
    setAutoScrollEnabled(true);

    if (cached) {
      setMessages(cached);
      setHasMoreHistory(cachedHasMore);
      scrollToBottom("auto");
    } else {
      setMessages([]);
      setHasMoreHistory(false);
    }

    // 始终触发一次同步请求（避免缓存过期）
    setLoadingMessages(true);

    activeConversationIdRef.current = id;
    setActiveConversationId(id);
    setSidebarOpen(false);
  };

  const togglePinConversation = async (conv: Conversation) => {
    if (!userId) return;
    setUiError(null);
    setConversationActionBusyId(conv.id);

    const nextPinned = !Boolean(conv.pinned);
    const payload = nextPinned
      ? { pinned: true, pinned_at: new Date().toISOString() }
      : { pinned: false, pinned_at: null };

    const { error } = await supabase
      .from("knowledge_conversations")
      .update(payload)
      .eq("id", conv.id)
      .eq("user_id", userId);

    if (error) {
      setUiError(`置顶操作失败：${error.message}`);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, ...payload } : c)),
      );
      void loadConversations();
    }

    setConversationActionBusyId(null);
  };

  const openRenameConversation = (conv: Conversation) => {
    setRenameConversationId(conv.id);
    setRenameTitle((conv.title || "新对话").trim() || "新对话");
    setRenameDialogOpen(true);
  };

  const submitRenameConversation = async () => {
    if (!userId || !renameConversationId) return;

    const nextTitle = renameTitle.trim();
    if (!nextTitle) {
      setUiError("标题不能为空");
      return;
    }

    setUiError(null);
    setConversationActionBusyId(renameConversationId);

    const { error } = await supabase
      .from("knowledge_conversations")
      .update({ title: nextTitle })
      .eq("id", renameConversationId)
      .eq("user_id", userId);

    if (error) {
      setUiError(`重命名失败：${error.message}`);
    } else {
      setConversations((prev) => prev.map((c) => (c.id === renameConversationId ? { ...c, title: nextTitle } : c)));
      setRenameDialogOpen(false);
      setRenameConversationId(null);
      void loadConversations();
    }

    setConversationActionBusyId(null);
  };

  const openDeleteConversation = (conv: Conversation) => {
    setDeleteConversationId(conv.id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteConversation = async () => {
    if (!userId || !deleteConversationId) return;

    setUiError(null);
    setConversationActionBusyId(deleteConversationId);

    const { error } = await supabase
      .from("knowledge_conversations")
      .delete()
      .eq("id", deleteConversationId)
      .eq("user_id", userId);

    if (error) {
      setUiError(`删除失败：${error.message}`);
      setConversationActionBusyId(null);
      return;
    }

    delete messagesCacheRef.current[deleteConversationId];

    let nextActiveId: string | null = null;
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== deleteConversationId);
      if (activeConversationId === deleteConversationId) {
        nextActiveId = next.length > 0 ? next[0].id : null;
      }
      return next;
    });

    if (activeConversationId === deleteConversationId) {
      setActiveConversationId(nextActiveId);
      setMessages([]);
    }

    setDeleteDialogOpen(false);
    setDeleteConversationId(null);
    setConversationActionBusyId(null);
    void loadConversations();
  };

  const createConversation = async (): Promise<Conversation | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("knowledge_conversations")
      .insert({ user_id: userId, title: "新对话" })
      .select()
      .single();

    if (error) {
      setUiError(`创建对话失败：${error.message}`);
      return null;
    }

    const conv = data as Conversation;
    setConversations((prev) => [conv, ...prev]);
    activeConversationIdRef.current = conv.id;
    setActiveConversationId(conv.id);
    messagesCacheRef.current[conv.id] = [];
    setMessages([]);
    setDraft("");
    return conv;
  };

  const handleNewConversation = async () => {
    await createConversation();
  };

  const ensureConversationIdForSend = async (): Promise<string | null> => {
    if (!userId) return null;

    if (activeConversationId) return activeConversationId;

    // 兜底：如果已有会话但当前未选中，默认选第一个
    if (conversations.length > 0) {
      const id = conversations[0].id;
      activeConversationIdRef.current = id;
      setActiveConversationId(id);
      return id;
    }

    const conv = await createConversation();
    return conv?.id ?? null;
  };

  const handleSend = async () => {
    if (!userId || !draft.trim() || sending) return;

    const convId = await ensureConversationIdForSend();
    if (!convId) return;

    const userMsgContent = draft.trim();
    setDraft("");
    setSending(true);
    setUiError(null);

    const { data: userMsg, error: userMsgErr } = await supabase
      .from("knowledge_messages")
      .insert({
        conversation_id: convId,
        user_id: userId,
        role: "user",
        content: userMsgContent,
      })
      .select()
      .single();

    if (userMsgErr) {
      setUiError(`发送消息失败：${userMsgErr.message}`);
      setSending(false);
      return;
    }

    const shouldUpdateCurrentView = activeConversationIdRef.current === convId;

    // 更新缓存，确保切换回来时能立刻看到最新上下文
    const nextCachedUserMsgs = [...(messagesCacheRef.current[convId] || []), userMsg as ChatMessage];
    messagesCacheRef.current[convId] = nextCachedUserMsgs;

    if (shouldUpdateCurrentView) {
      lastMessagesMutationRef.current = "append";
      setMessages(nextCachedUserMsgs);
      scrollToBottom("smooth");
    }

    try {
      // 只发送 role/content，避免把 id 等字段传给模型接口导致 400
      // 注意：如果本次发送触发了“自动新建/切换会话”，此处的 messages 可能还是旧会话的，需兜底。
      const baseMessages = convId === activeConversationId ? messages : [];
      const outboundMessages = [...baseMessages, { role: "user", content: userMsgContent }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/knowledge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outboundMessages }),
      });

      if (!response.ok) {
        const t = await response.text().catch(() => "");
        throw new Error(`AI 响应错误（${response.status}）：${t.slice(0, 240)}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      let assistantMsgId = "";
      let fullContent = "";

      const getDeltaContent = (parsed: any): string => {
        // 兼容：后端如果自己封装 {content}，也能工作
        if (typeof parsed?.content === "string") return parsed.content;
        // OpenAI Chat Completions streaming：choices[0].delta.content
        const delta = parsed?.choices?.[0]?.delta;
        if (typeof delta?.content === "string") return delta.content;
        return "";
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr);
            if (typeof parsed?.id === "string") assistantMsgId = parsed.id;

            const deltaText = getDeltaContent(parsed);
            if (!deltaText) continue;

            fullContent += deltaText;

            // 如果用户已切换到其他会话：不把 streaming 内容写入当前窗口，避免“看起来切换失败”
            if (activeConversationIdRef.current === convId) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  lastMessagesMutationRef.current = "append";
                  return [...prev.slice(0, -1), { ...last, content: fullContent }];
                }
                lastMessagesMutationRef.current = "append";
                return [...prev, { id: assistantMsgId || "temp", role: "assistant", content: fullContent }];
              });

              if (autoScrollEnabledRef.current) scrollToBottom("smooth");
            }
          } catch (e) {
            console.error("Parse chunk error:", e);
          }
        }
      }

      // 落库 assistant 消息（否则刷新后看不到回答）
      if (fullContent.trim()) {
        const { data: assistantRow, error: assistantErr } = await supabase
          .from("knowledge_messages")
          .insert({
            conversation_id: convId,
            user_id: userId,
            role: "assistant",
            content: fullContent,
          })
          .select()
          .single();

        if (assistantErr) {
          throw new Error(`保存回答失败：${assistantErr.message}`);
        }

        const saved = assistantRow as ChatMessage;

        // 用真实消息行替换掉窗口中的临时 assistant 消息（保证后续可复制/点赞/删除/重新回答）
        const cached = messagesCacheRef.current[convId] || [];
        const nextCached = cached.slice();
        if (nextCached.length > 0 && nextCached[nextCached.length - 1]?.role === "assistant") {
          nextCached[nextCached.length - 1] = saved;
        } else {
          nextCached.push(saved);
        }
        messagesCacheRef.current[convId] = nextCached;

        if (activeConversationIdRef.current === convId) {
          setMessages((prev) => {
            if (prev.length === 0) return [saved];
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), saved];
            }
            return [...prev, saved];
          });
        }

        const nowIso = new Date().toISOString();
        await supabase
          .from("knowledge_conversations")
          .update({
            last_message_preview: toPreview(fullContent),
            last_message_at: nowIso,
          })
          .eq("id", convId);
      }

      const cited = extractCitedNoteIds(fullContent);
      if (cited.length > 0) void ensureNoteMeta(cited);

      void loadConversations();
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "对话发生错误");
    } finally {
      setSending(false);
    }
  };

  const patchMessageInConversation = useCallback(
    (convId: string, messageId: string, patch: Partial<ChatMessage>) => {
      messagesCacheRef.current[convId] = (messagesCacheRef.current[convId] || []).map((m) => (m.id === messageId ? { ...m, ...patch } : m));

      if (activeConversationIdRef.current === convId) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...patch } : m)));
      }
    },
    [],
  );

  const removeMessageInConversation = useCallback(
    (convId: string, messageId: string) => {
      messagesCacheRef.current[convId] = (messagesCacheRef.current[convId] || []).filter((m) => m.id !== messageId);
      if (activeConversationIdRef.current === convId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    },
    [],
  );

  const copyMessageContent = useCallback(async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content || "");
      setCopiedMessageId(m.id);
      window.setTimeout(() => {
        setCopiedMessageId((cur) => (cur === m.id ? null : cur));
      }, 1200);
    } catch {
      setUiError("复制失败：请检查浏览器权限");
    }
  }, []);

  const setMessageRating = useCallback(
    async (messageId: string, nextRating: number | null) => {
      if (!activeConversationId) return;

      setMessageActionBusyId(messageId);
      patchMessageInConversation(activeConversationId, messageId, { rating: nextRating });

      const { error } = await supabase.from("knowledge_messages").update({ rating: nextRating }).eq("id", messageId);

      if (error) {
        // 兼容：数据库还未跑到 rating 字段迁移
        if (typeof error.message === "string" && error.message.includes("rating")) {
          setUiError("当前数据库尚未迁移消息反馈字段（rating）。请应用最新 Supabase migrations 后重试。");
        } else {
          setUiError(`更新反馈失败：${error.message}`);
        }
      }

      setMessageActionBusyId(null);
    },
    [activeConversationId, patchMessageInConversation, supabase],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversationId) return;

      const convId = activeConversationId;
      setMessageActionBusyId(messageId);

      const before = messagesCacheRef.current[convId] || messages;
      const deletingLast = before[before.length - 1]?.id === messageId;

      // 乐观移除，失败再回滚（重新拉取）
      removeMessageInConversation(convId, messageId);

      const { error } = await supabase.from("knowledge_messages").delete().eq("id", messageId);

      if (error) {
        setUiError(`删除消息失败：${error.message}`);
        void loadMessages(convId);
      } else {
        // 如果删的是最后一条消息，需要同步更新会话预览
        if (deletingLast) {
          const { data: lastData, error: lastErr } = await supabase
            .from("knowledge_messages")
            .select("content, created_at")
            .eq("conversation_id", convId)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!lastErr) {
            const last = (lastData ?? [])[0] as { content?: string | null; created_at?: string | null } | undefined;
            await supabase
              .from("knowledge_conversations")
              .update({
                last_message_preview: last?.content ? toPreview(last.content) : null,
                last_message_at: last?.created_at ?? null,
              })
              .eq("id", convId);
          }
        }

        void loadConversations();
      }

      setMessageActionBusyId(null);
    },
    [activeConversationId, loadConversations, loadMessages, messages, removeMessageInConversation, supabase],
  );

  const exportActiveConversationMarkdown = useCallback(async () => {
    if (!activeConversationId) return;

    setExportingMarkdown(true);
    setUiError(null);

    try {
      const conv = conversations.find((c) => c.id === activeConversationId);
      const title = conv?.title?.trim() || "对话";

      const { data, error } = await supabase
        .from("knowledge_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const lines: string[] = [];
      lines.push(`# ${title}`);
      lines.push("");
      lines.push(`导出时间：${new Date().toISOString()}`);
      lines.push("---");
      lines.push("");

      for (const m of (data ?? []) as any[]) {
        const who = m.role === "user" ? "你" : "知识库";
        lines.push(`## ${who}`);
        if (m.created_at) lines.push(`> ${m.created_at}`);
        lines.push("");
        lines.push(String(m.content ?? ""));
        lines.push("");
      }

      const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const stamp = new Date();
      const y = stamp.getFullYear();
      const mm = String(stamp.getMonth() + 1).padStart(2, "0");
      const dd = String(stamp.getDate()).padStart(2, "0");
      const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeTitle}-${y}${mm}${dd}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExportingMarkdown(false);
    }
  }, [activeConversationId, conversations, supabase]);

  const regenerateAssistantMessage = useCallback(
    async (assistantMessageId: string) => {
      if (!userId || !activeConversationId) return;
      if (sending) return;

      const convId = activeConversationId;
      const list = (messagesCacheRef.current[convId] || messages).slice();
      const idx = list.findIndex((m) => m.id === assistantMessageId);
      if (idx < 0) {
        setUiError("找不到要重新回答的消息");
        return;
      }

      // 找到该 assistant 前最近的一条 user 消息作为 prompt
      let userIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (list[i]?.role === "user") {
          userIdx = i;
          break;
        }
      }

      if (userIdx < 0) {
        setUiError("找不到对应的用户问题，无法重新回答");
        return;
      }

      const outboundMessages = list.slice(0, userIdx + 1).map((m) => ({ role: m.role, content: m.content }));

      setMessageActionBusyId(assistantMessageId);
      patchMessageInConversation(convId, assistantMessageId, { content: "" });

      try {
        const response = await fetch("/api/knowledge/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: outboundMessages }),
        });

        if (!response.ok) {
          const t = await response.text().catch(() => "");
          throw new Error(`AI 响应错误（${response.status}）：${t.slice(0, 240)}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");

        let fullContent = "";
        const getDeltaContent = (parsed: any): string => {
          if (typeof parsed?.content === "string") return parsed.content;
          const delta = parsed?.choices?.[0]?.delta;
          if (typeof delta?.content === "string") return delta.content;
          return "";
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              const deltaText = getDeltaContent(parsed);
              if (!deltaText) continue;

              fullContent += deltaText;
              patchMessageInConversation(convId, assistantMessageId, { content: fullContent });

              if (autoScrollEnabledRef.current) scrollToBottom("smooth");
            } catch (e) {
              console.error("Parse chunk error:", e);
            }
          }
        }

        if (fullContent.trim()) {
          const { error: updateErr } = await supabase
            .from("knowledge_messages")
            .update({ content: fullContent })
            .eq("id", assistantMessageId);

          if (updateErr) throw updateErr;

          // 如果这是最后一条消息，顺手更新会话预览
          if (idx === list.length - 1) {
            const nowIso = new Date().toISOString();
            await supabase
              .from("knowledge_conversations")
              .update({ last_message_preview: toPreview(fullContent), last_message_at: nowIso })
              .eq("id", convId);
          }
        }

        const cited = extractCitedNoteIds(fullContent);
        if (cited.length > 0) void ensureNoteMeta(cited);

        void loadConversations();
      } catch (e) {
        setUiError(e instanceof Error ? e.message : "重新回答失败");
      } finally {
        setMessageActionBusyId(null);
      }
    },
    [activeConversationId, ensureNoteMeta, loadConversations, messages, patchMessageInConversation, scrollToBottom, sending, supabase, userId],
  );

  // --- Topics Logic ---
  const loadTopics = async (opts?: { autoSelectFirst?: boolean }) => {
    if (!userId) return;
    setLoadingTopics(true);
    setUiError(null);

    try {
      const res = await fetch("/api/knowledge/topics", { method: "GET" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`加载专题失败（${res.status}）：${t.slice(0, 240)}`);
      }

      const json = (await res.json().catch(() => null)) as { topics?: Topic[] } | null;
      const list = Array.isArray(json?.topics) ? (json!.topics as Topic[]) : [];

      setTopics(list);
      if (opts?.autoSelectFirst && list.length > 0 && !activeTopicId) {
        void selectTopic(list[0].id);
      }
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "加载专题失败");
    } finally {
      setLoadingTopics(false);
    }
  };

  const loadTopicDetail = async (topicId: string) => {
    setLoadingTopicDetail(true);
    setUiError(null);

    const res = await fetch(`/api/knowledge/topics/${topicId}`, { method: "GET" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setUiError(`加载专题失败（${res.status}）：${t.slice(0, 240)}`);
      setLoadingTopicDetail(false);
      return;
    }

    const data = (await res.json().catch(() => null)) as TopicDetail | null;
    if (!data) {
      setUiError("加载专题失败：响应为空");
      setLoadingTopicDetail(false);
      return;
    }

    setTopicDetail(data);

    const cited = extractCitedNoteIds(data.topic?.summary_markdown || "");
    if (cited.length > 0) void ensureNoteMeta(cited);

    setLoadingTopicDetail(false);
  };

  const selectTopic = async (topicId: string) => {
    setActiveTopicId(topicId);
    setSidebarOpen(false);
    await loadTopicDetail(topicId);
  };

  const handleTopicDragStart = (e: DragEvent, topicId: string) => {
    if (!topicId) return;
    try {
      e.dataTransfer.setData("text/plain", topicId);
      e.dataTransfer.effectAllowed = "link";
    } catch {
      // ignore
    }
    setDraggingTopicId(topicId);
  };

  const handleTopicDragEnd = () => {
    setDraggingTopicId(null);
    setDragOverTopicId(null);
  };

  const handleTopicDragOver = (e: DragEvent, topicId: string) => {
    if (!draggingTopicId || draggingTopicId === topicId) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "link";
    } catch {
      // ignore
    }
    if (dragOverTopicId !== topicId) setDragOverTopicId(topicId);
  };

  const handleTopicDrop = (e: DragEvent, targetTopicId: string) => {
    e.preventDefault();
    const sourceTopicId = e.dataTransfer.getData("text/plain") || draggingTopicId;
    if (!sourceTopicId || !targetTopicId || sourceTopicId === targetTopicId) {
      handleTopicDragEnd();
      return;
    }

    setDragMergeSourceTopicId(sourceTopicId);
    setDragMergeTargetTopicId(targetTopicId);
    setDragMergeDialogOpen(true);
    handleTopicDragEnd();
  };

  const togglePinTopic = async (t: Topic) => {
    setUiError(null);
    setTopicActionBusyId(t.id);

    try {
      const res = await fetch(`/api/knowledge/topics/${t.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !Boolean(t.pinned) }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`置顶操作失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      await loadTopics();
      if (activeTopicId === t.id) await loadTopicDetail(t.id);
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "置顶操作失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const toggleArchiveTopic = async (t: Topic) => {
    setUiError(null);
    setTopicActionBusyId(t.id);

    try {
      const res = await fetch(`/api/knowledge/topics/${t.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !Boolean(t.archived) }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`归档操作失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      await loadTopics();
      if (activeTopicId === t.id) await loadTopicDetail(t.id);
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "归档操作失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const rewriteTopicReport = async (topicId: string, mode: "report_only" | "full" = "report_only") => {
    setUiError(null);
    setTopicActionBusyId(topicId);

    try {
      const res = await fetch(`/api/knowledge/topics/${topicId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`生成报告失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      await loadTopicDetail(topicId);
      await loadTopics();
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "生成报告失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const mergeTopicIntoActive = async (sourceTopicId: string) => {
    if (!activeTopicId) return;
    await mergeTopicIntoTarget(activeTopicId, sourceTopicId);
  };

  const mergeTopicIntoTarget = async (targetTopicId: string, sourceTopicId: string) => {
    if (!targetTopicId || !sourceTopicId || targetTopicId === sourceTopicId) return;

    setUiError(null);
    setTopicActionBusyId(targetTopicId);

    try {
      const res = await fetch(`/api/knowledge/topics/${targetTopicId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTopicId }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`合并失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      setMergeDialogOpen(false);
      setMergeSourceTopicId(null);

      setDragMergeDialogOpen(false);
      setDragMergeSourceTopicId(null);
      setDragMergeTargetTopicId(null);

      await loadTopics();
      await selectTopic(targetTopicId);
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "合并失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const topicMemberAction = async (topicId: string, noteId: string, action: "remove" | "confirm") => {
    setUiError(null);
    setTopicActionBusyId(topicId);

    try {
      const res = await fetch(`/api/knowledge/topics/${topicId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, noteId }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`操作失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      await loadTopicDetail(topicId);
      await loadTopics();
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const topicMemberAddToTopic = async (topicId: string, noteId: string) => {
    setUiError(null);
    setTopicActionBusyId(topicId);

    try {
      const res = await fetch(`/api/knowledge/topics/${topicId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", noteId }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`加入失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      await loadTopics();
      if (activeTopicId === topicId) await loadTopicDetail(topicId);
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "加入失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const topicMemberSetEventTime = async (topicId: string, noteId: string, eventTimeIso: string) => {
    setUiError(null);
    setTopicActionBusyId(topicId);

    try {
      const res = await fetch(`/api/knowledge/topics/${topicId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_time", noteId, eventTime: eventTimeIso }),
      });

      if (!res.ok) {
        const tx = await res.text().catch(() => "");
        throw new Error(`纠错失败（${res.status}）：${tx.slice(0, 240)}`);
      }

      await loadTopicDetail(topicId);
      await loadTopics();
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "纠错失败");
    } finally {
      setTopicActionBusyId(null);
    }
  };

  const openAddToTopicDialog = (noteId: string) => {
    setAddToTopicNoteId(noteId);
    setAddToTopicTargetTopicId(null);
    setAddToTopicDialogOpen(true);
  };

  const openCorrectTimeDialog = (topicId: string, noteId: string, currentIso?: string | null) => {
    setCorrectTimeTopicId(topicId);
    setCorrectTimeNoteId(noteId);

    const v = currentIso ? new Date(currentIso).toISOString().slice(0, 16) : "";
    setCorrectTimeValue(v);

    setCorrectTimeDialogOpen(true);
  };

  const openTopicItemContextMenu = (e: ReactMouseEvent, topicId: string, member: TopicMember) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      topicId,
      noteId: member.noteId,
      note: member.note,
      timeIso: member.event_time || member.time,
    });
  };

  const rebuildTopics = async () => {
    setUiError(null);
    setRebuildingTopics(true);

    try {
      const res = await fetch("/api/knowledge/topics/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`生成/刷新专题失败（${res.status}）：${t.slice(0, 400)}`);
      }

      await loadTopics({ autoSelectFirst: true });
    } catch (e) {
      setUiError(e instanceof Error ? e.message : "生成/刷新专题失败");
    } finally {
      setRebuildingTopics(false);
    }
  };

  useEffect(() => {
    if (subView !== "topics") return;
    void loadTopics({ autoSelectFirst: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subView, userId]);

  const topicGroups = useMemo(() => {
    const pinned: Topic[] = [];
    const active: Topic[] = [];
    const archived: Topic[] = [];

    for (const t of topics) {
      if (Boolean(t.archived)) archived.push(t);
      else if (Boolean(t.pinned)) pinned.push(t);
      else active.push(t);
    }

    return { pinned, active, archived };
  }, [topics]);

  const canSend = !sending && draft.trim().length > 0;
  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const renameConversation = conversations.find((c) => c.id === renameConversationId) ?? null;
  const deletingConversation = conversations.find((c) => c.id === deleteConversationId) ?? null;

  const dragMergeSourceTopic = topics.find((t) => t.id === dragMergeSourceTopicId) ?? null;
  const dragMergeTargetTopic = topics.find((t) => t.id === dragMergeTargetTopicId) ?? null;

  const topicVideos = useMemo(() => {
    if (!topicDetail) return [] as TopicMember[];

    const pool = [...(topicDetail.members || [])];
    pool.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return pool.filter((m) => m?.note?.content_type === "video" && Boolean(m.note.source_url));
  }, [topicDetail]);

  const openVideoPreviewForNote = useCallback(
    (note: TopicNote) => {
      const rawUrl = note.source_url?.trim() || "";
      if (!rawUrl) {
        setUiError("该条目没有来源链接，无法预览视频");
        return;
      }

      const r = toVideoPreviewUrl(rawUrl);
      if (!r.url) {
        setUiError("该条目缺少可预览的视频链接");
        return;
      }

      setVideoPreview({
        title: note.title?.trim() || note.site_name || "视频预览",
        url: r.url,
        kind: r.kind,
      });
      setVideoPreviewOpen(true);
    },
    [setUiError],
  );

  return (
    <div className={cn("flex flex-1 min-h-0", subView === "topics" ? "bg-[#F8FAFC] dark:bg-slate-950" : "bg-slate-50/30", className)}>
      {/* Sidebar - 只在 chat 模式下显示列表，topics 采用沉浸式仪表盘 */}
      {subView === "chat" ? (
        <div
          className={cn(
            "w-[280px] border-r border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/70 backdrop-blur flex-shrink-0 flex flex-col",
            sidebarOpen ? "" : "hidden md:flex",
          )}
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/70">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {subView === "chat" ? "历史对话" : "专题列表"}
            </h3>

            {subView === "chat" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                onClick={handleNewConversation}
                disabled={!userId}
                title="新建对话"
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                onClick={rebuildTopics}
                disabled={rebuildingTopics || !userId}
                title="生成/刷新专题"
              >
                <RefreshCw className={cn("h-4 w-4", rebuildingTopics && "animate-spin")} />
              </Button>
            )}
          </div>

          <div className="relative flex-1 min-h-0 overflow-y-auto p-2">
            {uiError && <div className="px-2 py-2 text-xs text-red-600">{uiError}</div>}

            {(subView === "chat" ? loadingConversations && conversations.length > 0 : loadingTopics && topics.length > 0) && (
              <div className="pointer-events-none absolute top-2 right-2 z-10 text-[11px] text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200/70 dark:border-slate-700/70 rounded-full px-2 py-0.5 shadow-sm">
                同步中...
              </div>
            )}

            {subView === "chat" ? (
              <div>
                {conversations.length === 0 ? (
                  loadingConversations ? (
                    <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">加载对话列表中...</div>
                  ) : (
                    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                      <div className="p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">还没有对话</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">点击右上角 "+" 新建一个对话。</div>
                      </div>
                    </Card>
                  )
                ) : (
                  <div
                    className={cn(
                      "space-y-1 transition-opacity duration-200",
                      loadingConversations && "opacity-70",
                    )}
                  >
                    {conversations.map((c) => {
                      const active = c.id === activeConversationId;
                      const title = c.title?.trim() || "新对话";
                      const preview = c.last_message_preview?.trim() || "";

                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "group flex items-stretch rounded-xl border transition-colors overflow-hidden",
                            active
                              ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/60"
                              : "bg-white/60 dark:bg-slate-800/60 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200/70 dark:hover:border-slate-700/70",
                          )}
                        >
                          <button
                            type="button"
                            className="flex-1 min-w-0 text-left px-3 py-2"
                            onClick={() => selectConversation(c.id)}
                          >
                            <div className="flex items-center gap-2">
                              {Boolean(c.pinned) && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{title}</div>
                                <div
                                  className={cn(
                                    "mt-0.5 text-[12px] truncate break-all",
                                    preview ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500",
                                  )}
                                >
                                  {preview || "暂无消息"}
                                </div>
                              </div>
                            </div>
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "w-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-colors",
                                  active ? "bg-blue-50/30 dark:bg-blue-950/20" : "bg-transparent",
                                )}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="对话操作"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                disabled={conversationActionBusyId === c.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void togglePinConversation(c);
                                }}
                              >
                                <Pin className="h-4 w-4 mr-2" />
                                {Boolean(c.pinned) ? "取消置顶" : "置顶"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={conversationActionBusyId === c.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRenameConversation(c);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={conversationActionBusyId === c.id}
                                className="text-red-600 focus:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteConversation(c);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {topics.length === 0 ? (
                  loadingTopics ? (
                    <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">加载专题列表中...</div>
                  ) : (
                    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                      <div className="p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">还没有智能专题</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">点击右上角刷新按钮，按需生成/刷新专题。</div>
                      </div>
                    </Card>
                  )
                ) : (
                  <div
                    className={cn(
                      "space-y-2 transition-opacity duration-200",
                      loadingTopics && "opacity-70",
                    )}
                  >
                    {topicGroups.pinned.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">置顶</div>
                        <div className="space-y-1">
                          {topicGroups.pinned.map((t) => {
                            const active = t.id === activeTopicId;
                            const title = t.title?.trim() || "未命名专题";
                            const preview = (t.summary_markdown || "").trim();
                            const count = typeof t.member_count === "number" ? t.member_count : null;
                            const isNew = isTopicNew(t.last_ingested_at);

                            return (
                              <div
                                key={t.id}
                                draggable={true}
                                onDragStart={(e) => handleTopicDragStart(e, t.id)}
                                onDragEnd={handleTopicDragEnd}
                                onDragOver={(e) => handleTopicDragOver(e, t.id)}
                                onDragLeave={() => dragOverTopicId === t.id && setDragOverTopicId(null)}
                                onDrop={(e) => handleTopicDrop(e, t.id)}
                                className={cn(
                                  "group flex items-stretch rounded-xl border transition-colors overflow-hidden",
                                  active
                                    ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60"
                                    : "bg-white/60 dark:bg-slate-800/60 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200/70 dark:hover:border-slate-700/70",
                                  draggingTopicId === t.id && "opacity-70",
                                  dragOverTopicId === t.id && "ring-2 ring-amber-400/60",
                                )}
                              >
                                <button
                                  type="button"
                                  className="flex-1 min-w-0 text-left px-3 py-2"
                                  onClick={() => selectTopic(t.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1 text-[13px] font-semibold text-slate-900 dark:text-white truncate">{title}</div>
                                        {isNew && (
                                          <div className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/70 rounded-full px-2 py-0.5">
                                            New
                                          </div>
                                        )}
                                        {count !== null && (
                                          <div className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 rounded-full px-2 py-0.5">
                                            {count}
                                          </div>
                                        )}
                                      </div>
                                      <div
                                        className={cn(
                                          "mt-0.5 text-[12px] truncate break-all",
                                          preview ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500",
                                        )}
                                      >
                                        {preview ? toPreview(preview, 70) : "暂无报告"}
                                      </div>
                                    </div>
                                  </div>
                                </button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className={cn(
                                        "w-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-colors",
                                        active ? "bg-amber-50/30 dark:bg-amber-950/20" : "bg-transparent",
                                      )}
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label="专题操作"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem
                                      disabled={topicActionBusyId === t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void togglePinTopic(t);
                                      }}
                                    >
                                      <Pin className="h-4 w-4 mr-2" />
                                      取消置顶
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={topicActionBusyId === t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void toggleArchiveTopic(t);
                                      }}
                                    >
                                      <Archive className="h-4 w-4 mr-2" />
                                      归档
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={topicActionBusyId === t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void rewriteTopicReport(t.id, "report_only");
                                      }}
                                    >
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      生成/重写报告
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {topicGroups.active.length > 0 && (
                      <div>
                        {topicGroups.pinned.length > 0 && (
                          <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">全部</div>
                        )}
                        <div className="space-y-1">
                          {topicGroups.active.map((t) => {
                            const active = t.id === activeTopicId;
                            const title = t.title?.trim() || "未命名专题";
                            const preview = (t.summary_markdown || "").trim();
                            const count = typeof t.member_count === "number" ? t.member_count : null;
                            const isNew = isTopicNew(t.last_ingested_at);

                            return (
                              <div
                                key={t.id}
                                draggable={true}
                                onDragStart={(e) => handleTopicDragStart(e, t.id)}
                                onDragEnd={handleTopicDragEnd}
                                onDragOver={(e) => handleTopicDragOver(e, t.id)}
                                onDragLeave={() => dragOverTopicId === t.id && setDragOverTopicId(null)}
                                onDrop={(e) => handleTopicDrop(e, t.id)}
                                className={cn(
                                  "group flex items-stretch rounded-xl border transition-colors overflow-hidden",
                                  active
                                    ? "bg-amber-50/60 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60"
                                    : "bg-white/60 dark:bg-slate-800/60 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200/70 dark:hover:border-slate-700/70",
                                  draggingTopicId === t.id && "opacity-70",
                                  dragOverTopicId === t.id && "ring-2 ring-amber-400/60",
                                )}
                              >
                                <button
                                  type="button"
                                  className="flex-1 min-w-0 text-left px-3 py-2"
                                  onClick={() => selectTopic(t.id)}
                                >
                                  <div className="flex items-center gap-2">
                                    {Boolean(t.pinned) && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1 text-[13px] font-semibold text-slate-900 dark:text-white truncate">{title}</div>
                                        {isNew && (
                                          <div className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/70 rounded-full px-2 py-0.5">
                                            New
                                          </div>
                                        )}
                                        {count !== null && (
                                          <div className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 rounded-full px-2 py-0.5">
                                            {count}
                                          </div>
                                        )}
                                      </div>
                                      <div
                                        className={cn(
                                          "mt-0.5 text-[12px] truncate break-all",
                                          preview ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500",
                                        )}
                                      >
                                        {preview ? toPreview(preview, 70) : "暂无报告"}
                                      </div>
                                    </div>
                                  </div>
                                </button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className={cn(
                                        "w-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-colors",
                                        active ? "bg-amber-50/30 dark:bg-amber-950/20" : "bg-transparent",
                                      )}
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label="专题操作"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem
                                      disabled={topicActionBusyId === t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void togglePinTopic(t);
                                      }}
                                    >
                                      <Pin className="h-4 w-4 mr-2" />
                                      {Boolean(t.pinned) ? "取消置顶" : "置顶"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={topicActionBusyId === t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void toggleArchiveTopic(t);
                                      }}
                                    >
                                      <Archive className="h-4 w-4 mr-2" />
                                      归档
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={topicActionBusyId === t.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void rewriteTopicReport(t.id, "report_only");
                                      }}
                                    >
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      生成/重写报告
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {topicGroups.archived.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          className="w-full px-2 py-1 text-left text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                          onClick={() => setShowArchivedTopics((v) => !v)}
                        >
                          已归档（{topicGroups.archived.length}）{showArchivedTopics ? " · 收起" : " · 展开"}
                        </button>

                        {showArchivedTopics && (
                          <div className="mt-1 space-y-1">
                            {topicGroups.archived.map((t) => {
                              const active = t.id === activeTopicId;
                              const title = t.title?.trim() || "未命名专题";
                              const preview = (t.summary_markdown || "").trim();
                              const count = typeof t.member_count === "number" ? t.member_count : null;

                              return (
                                <div
                                  key={t.id}
                                  draggable={true}
                                  onDragStart={(e) => handleTopicDragStart(e, t.id)}
                                  onDragEnd={handleTopicDragEnd}
                                  onDragOver={(e) => handleTopicDragOver(e, t.id)}
                                  onDragLeave={() => dragOverTopicId === t.id && setDragOverTopicId(null)}
                                  onDrop={(e) => handleTopicDrop(e, t.id)}
                                  className={cn(
                                    "group flex items-stretch rounded-xl border transition-colors overflow-hidden",
                                    active
                                      ? "bg-amber-50/40 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/60"
                                      : "bg-white/50 dark:bg-slate-800/50 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200/70 dark:hover:border-slate-700/70",
                                    draggingTopicId === t.id && "opacity-70",
                                    dragOverTopicId === t.id && "ring-2 ring-amber-400/60",
                                  )}
                                >
                                  <button
                                    type="button"
                                    className="flex-1 min-w-0 text-left px-3 py-2"
                                    onClick={() => selectTopic(t.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Archive className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <div className="min-w-0 flex-1 text-[13px] font-semibold text-slate-900 dark:text-white truncate">{title}</div>
                                          {count !== null && (
                                            <div className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 rounded-full px-2 py-0.5">
                                              {count}
                                            </div>
                                          )}
                                        </div>
                                        <div
                                          className={cn(
                                            "mt-0.5 text-[12px] truncate break-all",
                                            preview ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500",
                                          )}
                                        >
                                          {preview ? toPreview(preview, 70) : "暂无报告"}
                                        </div>
                                      </div>
                                    </div>
                                  </button>

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className={cn(
                                          "w-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-colors",
                                          active ? "bg-amber-50/20 dark:bg-amber-950/10" : "bg-transparent",
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label="专题操作"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuItem
                                        disabled={topicActionBusyId === t.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void toggleArchiveTopic(t);
                                        }}
                                      >
                                        <Archive className="h-4 w-4 mr-2" />
                                        取消归档
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={topicActionBusyId === t.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void togglePinTopic(t);
                                        }}
                                      >
                                        <Pin className="h-4 w-4 mr-2" />
                                        {Boolean(t.pinned) ? "取消置顶" : "置顶"}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
              )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Rename Conversation Dialog */}
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setRenameConversationId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>重命名对话</DialogTitle>
            <DialogDescription>修改对话标题，方便后续快速找到该会话。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              当前：<span className="text-slate-700 dark:text-slate-300">{renameConversation?.title?.trim() || "新对话"}</span>
            </div>
            <Input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="输入新的对话标题"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitRenameConversation();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={conversationActionBusyId === renameConversationId}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => void submitRenameConversation()}
              disabled={conversationActionBusyId === renameConversationId || renameTitle.trim().length === 0}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Confirm */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteConversationId(null);
        }}
        onConfirm={confirmDeleteConversation}
        title="删除对话"
        description={`将彻底删除该对话“${deletingConversation?.title?.trim() || "新对话"}”及其所有消息记录，此操作不可撤销。`}
        confirmText="确认删除"
        variant="destructive"
        loading={conversationActionBusyId === deleteConversationId}
      />

      {/* Merge Topic Dialog */}
      <Dialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          setMergeDialogOpen(open);
          if (!open) setMergeSourceTopicId(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>合并专题</DialogTitle>
            <DialogDescription>将另一个专题的所有条目合并到当前专题（保留当前专题 ID 与置顶/归档状态）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              目标：<span className="text-slate-700 dark:text-slate-300">{topicDetail?.topic?.title?.trim() || "当前专题"}</span>
            </div>

            <select
              className="w-full h-10 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 px-3 text-sm text-gray-800 dark:text-gray-200"
              value={mergeSourceTopicId ?? ""}
              onChange={(e) => setMergeSourceTopicId(e.target.value || null)}
              disabled={!activeTopicId}
            >
              <option value="" disabled>
                请选择要合并进来的专题…
              </option>
              {topics
                .filter((t) => t.id !== activeTopicId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.title || "未命名专题").trim()}
                  </option>
                ))}
            </select>

            <div className="text-xs text-slate-400 dark:text-slate-500">提示：合并后会重算事件节点与条目计数。</div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!activeTopicId || !mergeSourceTopicId || topicActionBusyId === activeTopicId}
              onClick={() => {
                if (mergeSourceTopicId) void mergeTopicIntoActive(mergeSourceTopicId);
              }}
            >
              确认合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Merge Topic Dialog */}
      <Dialog
        open={dragMergeDialogOpen}
        onOpenChange={(open) => {
          setDragMergeDialogOpen(open);
          if (!open) {
            setDragMergeSourceTopicId(null);
            setDragMergeTargetTopicId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>合并专题</DialogTitle>
            <DialogDescription>将来源专题合并进目标专题（拖拽触发）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-slate-700 dark:text-slate-300">
              目标：<span className="font-semibold">{dragMergeTargetTopic?.title?.trim() || "目标专题"}</span>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300">
              来源：<span className="font-semibold">{dragMergeSourceTopic?.title?.trim() || "来源专题"}</span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">提示：合并后会重算事件节点与条目计数。</div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDragMergeDialogOpen(false);
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!dragMergeSourceTopicId || !dragMergeTargetTopicId || topicActionBusyId === dragMergeTargetTopicId}
              onClick={() => {
                if (dragMergeSourceTopicId && dragMergeTargetTopicId) {
                  void mergeTopicIntoTarget(dragMergeTargetTopicId, dragMergeSourceTopicId);
                }
              }}
            >
              确认合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog
        open={videoPreviewOpen}
        onOpenChange={(open) => {
          setVideoPreviewOpen(open);
          if (!open) setVideoPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>{videoPreview?.title || "视频预览"}</DialogTitle>
            <DialogDescription>来自条目来源链接的快速预览。</DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 overflow-hidden bg-black">
            {videoPreview?.url ? (
              videoPreview.kind === "direct" ? (
                <video
                  className="w-full aspect-video bg-black"
                  src={videoPreview.url}
                  controls
                  playsInline
                />
              ) : (
                <iframe
                  src={videoPreview.url}
                  className="w-full aspect-video"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={videoPreview.title || "视频"}
                />
              )
            ) : (
              <div className="aspect-video flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">暂无可预览视频</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member To Topic Dialog */}
      <Dialog
        open={addToTopicDialogOpen}
        onOpenChange={(open) => {
          setAddToTopicDialogOpen(open);
          if (!open) {
            setAddToTopicNoteId(null);
            setAddToTopicTargetTopicId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>加入到其他专题</DialogTitle>
            <DialogDescription>将该条目手动加入到你选择的专题中。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">条目：{addToTopicNoteId ? addToTopicNoteId.slice(0, 8) : "-"}</div>

            <select
              className="w-full h-10 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 px-3 text-sm text-gray-800 dark:text-gray-200"
              value={addToTopicTargetTopicId ?? ""}
              onChange={(e) => setAddToTopicTargetTopicId(e.target.value || null)}
            >
              <option value="" disabled>
                请选择目标专题…
              </option>
              {topics
                .filter((t) => t.id !== topicDetail?.topic?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.title || "未命名专题").trim()}
                  </option>
                ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddToTopicDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!addToTopicNoteId || !addToTopicTargetTopicId || topicActionBusyId === addToTopicTargetTopicId}
              onClick={() => {
                if (addToTopicNoteId && addToTopicTargetTopicId) {
                  void topicMemberAddToTopic(addToTopicTargetTopicId, addToTopicNoteId);
                  setAddToTopicDialogOpen(false);
                }
              }}
            >
              确认加入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correct Event Time Dialog */}
      <Dialog
        open={correctTimeDialogOpen}
        onOpenChange={(open) => {
          setCorrectTimeDialogOpen(open);
          if (!open) {
            setCorrectTimeTopicId(null);
            setCorrectTimeNoteId(null);
            setCorrectTimeValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>纠错时间</DialogTitle>
            <DialogDescription>修正该条目的事件时间（将影响事件节点聚合）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">条目：{correctTimeNoteId ? correctTimeNoteId.slice(0, 8) : "-"}</div>
            <Input
              type="datetime-local"
              value={correctTimeValue}
              onChange={(e) => setCorrectTimeValue(e.target.value)}
              className="rounded-xl"
            />
            <div className="text-xs text-slate-400 dark:text-slate-500">按你的本地时区填写；保存后会重算该条目的事件指纹。</div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCorrectTimeDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!correctTimeTopicId || !correctTimeNoteId || !correctTimeValue || topicActionBusyId === correctTimeTopicId}
              onClick={() => {
                if (!correctTimeTopicId || !correctTimeNoteId || !correctTimeValue) return;
                const iso = new Date(correctTimeValue).toISOString();
                void topicMemberSetEventTime(correctTimeTopicId, correctTimeNoteId, iso);
                setCorrectTimeDialogOpen(false);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden", subView === "topics" ? "bg-[#F8FAFC] dark:bg-slate-950" : "bg-white dark:bg-slate-900")}>
        {subView === "graph" ? (
          <KnowledgeGraphView userId={userId || ""} />
        ) : subView === "quotes" ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-14 px-4 md:px-8 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/60 dark:bg-slate-900/60 backdrop-blur flex items-center gap-3 sticky top-0 z-10">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-xl border bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/30 flex items-center justify-center shrink-0">
                  <Quote className="h-4 w-4 text-rose-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">金句素材</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">记者的灵魂弹药库，在这里发现引人深思的观点、犀利的反讽和精准的数据</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={quoteMaterialsQuery}
                  onChange={(e) => setQuoteMaterialsQuery(e.target.value)}
                  placeholder="搜索金句…"
                  className="h-9 w-[220px] rounded-xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={() => void loadQuoteMaterials({ page: 1, append: false })}
                  disabled={quoteMaterialsLoading}
                  title="刷新"
                >
                  <RefreshCw className={cn("h-4 w-4", quoteMaterialsLoading ? "animate-spin" : "")} />
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-slate-50/30">
              {quoteMaterialsError ? (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl p-4 text-sm">
                  {quoteMaterialsError}
                </div>
              ) : quoteMaterialsLoading && quoteMaterials.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  加载中…
                </div>
              ) : quoteMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
                    <Quote className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <div className="text-slate-900 dark:text-white font-semibold">暂无金句素材</div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                    你可以在批注卡片里选择"设为金句素材"，或在阅读侧栏点"自动提取金句"。
                  </div>
                </div>
              ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                  {quoteMaterials.map((it, i) => {
                    const title = it.notes?.title?.trim() || "未命名笔记";
                    const site = it.notes?.site_name?.trim() || "";
                    const typeLabel = it.source_type === "llm" ? "自动" : "手动";
                    
                    const borderColors = [
                      "border-blue-300", "border-emerald-300", "border-amber-300", "border-rose-300", 
                      "border-violet-300", "border-indigo-300", "border-cyan-300", "border-fuchsia-300"
                    ];
                    const textColors = [
                      "text-blue-600", "text-emerald-600", "text-amber-600", "text-rose-600",
                      "text-violet-600", "text-indigo-600", "text-cyan-600", "text-fuchsia-600"
                    ];
                    const bgColors = [
                      "bg-blue-50", "bg-emerald-50", "bg-amber-50", "bg-rose-50",
                      "bg-violet-50", "bg-indigo-50", "bg-cyan-50", "bg-fuchsia-50"
                    ];
                    
                    const idx = i % borderColors.length;
                    const borderColor = borderColors[idx];
                    const textColor = textColors[idx];
                    const tagBg = bgColors[idx];

                    return (
                      <div key={it.id} className="break-inside-avoid mb-4">
                        <Card className={cn("group rounded-2xl border shadow-sm bg-white hover:shadow-md transition-all duration-300", borderColor)}>
                          <div className="p-5 flex flex-col gap-4">
                            <blockquote className="text-base text-slate-800 leading-relaxed font-medium font-serif">
                              <span className={cn("mr-1 font-sans font-bold opacity-60", textColor)}>“</span>
                              {it.content}
                              <span className={cn("ml-1 font-sans font-bold opacity-60", textColor)}>”</span>
                            </blockquote>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-800/50">
                              <div className="min-w-0 flex-1 mr-3">
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {site ? `${site} · ` : ""}{title}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className={cn("inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium opacity-90", tagBg, textColor)}>
                                    {typeLabel}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                  onClick={() => {
                                    navigator.clipboard.writeText(it.content);
                                    toast.success("已复制");
                                  }}
                                  title="复制"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600"
                                  onClick={() => {
                                    window.location.href = `/notes/${it.note_id}`;
                                  }}
                                  title="打开来源"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuItem onClick={() => {
                                      navigator.clipboard.writeText(it.content);
                                      toast.success("已复制内容");
                                    }}>
                                      <Copy className="h-4 w-4 mr-2" /> 复制内容
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      const text = `“${it.content}”\n—— ${it.notes?.title || "未知来源"}`;
                                      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `quote-${it.id.slice(0, 8)}.txt`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                      toast.success("已导出文本");
                                    }}>
                                      <FileDown className="h-4 w-4 mr-2" /> 导出文本
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      if (navigator.share) {
                                        navigator.share({
                                            title: '金句分享',
                                            text: `“${it.content}” —— ${it.notes?.title || ""}`,
                                            url: window.location.href
                                        }).catch(() => {});
                                      } else {
                                        navigator.clipboard.writeText(`“${it.content}” —— ${it.notes?.title || ""}`);
                                        toast.success("已复制分享文本");
                                      }
                                    }}>
                                      <Share2 className="h-4 w-4 mr-2" /> 分享
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => void deleteQuoteMaterial(it.id)} className="text-red-600 focus:text-red-600">
                                      <Trash2 className="h-4 w-4 mr-2" /> 删除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}

              {quoteMaterialsHasMore ? (
                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => void loadQuoteMaterials({ page: quoteMaterialsPage + 1, append: true })}
                    disabled={quoteMaterialsLoading}
                  >
                    加载更多
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : subView === "topics" ? (
          <TopicManagementView
            userId={userId || ""}
            topics={topics}
            loadingTopics={loadingTopics}
            rebuildingTopics={rebuildingTopics}
            onRebuild={rebuildTopics}
            onTopicAction={(t, action) => {
              if (action === "pin") void togglePinTopic(t);
              if (action === "archive") void toggleArchiveTopic(t);
            }}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Main Header */}
            <div className="h-14 px-4 md:px-8 border-b border-slate-200/70 dark:border-slate-700/70 bg-white/50 dark:bg-slate-900/50 backdrop-blur flex items-center justify-between gap-3 sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="md:hidden text-slate-600 dark:text-slate-400"
                  onClick={() => setSidebarOpen((v) => !v)}
                >
                  <List className="h-4 w-4" />
                </Button>

                <div
                  className={cn(
                    "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0",
                    subView === "chat" ? "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/30" : "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30",
                  )}
                >
                  {subView === "chat" ? (
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-amber-600" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {subView === "chat" ? activeConversation?.title?.trim() || "新对话" : topicDetail?.topic?.title?.trim() || "智能专题"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {subView === "chat"
                      ? "P0 语料：笔记正文 + 高亮 + 批注 + 逐字稿"
                      : "P1：语义聚类 → 专题报告 → 来源追溯"}
                  </div>
                </div>
              </div>

              {subView === "chat" ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
                    onClick={() => void exportActiveConversationMarkdown()}
                    disabled={!activeConversationId || exportingMarkdown}
                    title="导出 Markdown"
                  >
                    <Download className={cn("h-4 w-4", exportingMarkdown && "animate-pulse")} />
                    <span className="hidden md:inline">导出</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
                    onClick={() => loadConversations()}
                    disabled={loadingConversations}
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-1.5", loadingConversations && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-slate-500 dark:text-slate-400 hover:text-amber-600 transition-colors"
                  onClick={rebuildTopics}
                  disabled={rebuildingTopics}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1.5", rebuildingTopics && "animate-spin")} /> 刷新专题
                </Button>
              )}
            </div>

            {subView === "chat" ? (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Messages (scrollable) */}
                <div ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8">
                  <div className="mx-auto w-full max-w-3xl py-6">
                    {(hasMoreHistory || loadingOlderMessages) && (
                      <div className="mb-4 flex justify-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="bg-white dark:bg-slate-900"
                          disabled={!hasMoreHistory || loadingOlderMessages}
                          onClick={() => void loadOlderMessages()}
                        >
                          {loadingOlderMessages ? "加载中..." : "加载更早消息"}
                        </Button>
                      </div>
                    )}
                    {loadingMessages && messages.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">加载对话中...</div>
                    ) : messages.length === 0 ? (
                      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                        <div className="p-6">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center">
                              <Sparkles className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">从你的收藏里提问</div>
                              <div className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                例如："最近 AI 监管相关的要点是什么？"、"把我标注过的观点按正反两面总结"。
                              </div>
                              <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                                提示：回答会附带引用 [note:...]，你可以点击引用跳转到原笔记。
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <div
                        key={activeConversationId ?? "none"}
                        className="relative animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
                      >
                        {loadingMessages && (
                          <div className="pointer-events-none absolute -top-1 right-0 text-[11px] text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200/70 dark:border-slate-700/70 rounded-full px-2 py-0.5 shadow-sm">
                            同步中...
                          </div>
                        )}
                        <div className="space-y-3">
                        {messages.map((m) => {
                          const cited = m.role === "assistant" ? extractCitedNoteIds(m.content) : [];

                          return (
                            <Card
                              key={m.id}
                              className={cn(
                                "rounded-2xl border shadow-none",
                                m.role === "user" ? "border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900" : "border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20",
                              )}
                            >
                              <div className="p-4">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{m.role === "user" ? "你" : "知识库"}</div>

                                <div className="mt-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line break-words">
                                  {m.content || (m.role === "assistant" && sending ? "生成中..." : "")}
                                </div>

                                {m.role === "assistant" && cited.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {cited.map((id) => {
                                      const meta = noteMetaMap[id];
                                      const label = meta?.title || meta?.site_name || id.slice(0, 8);

                                      return (
                                        <button
                                          key={id}
                                          type="button"
                                          className="text-[11px] px-2 py-1 rounded-full border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                                          onClick={() => {
                                            window.location.href = `/notes/${id}`;
                                          }}
                                          title={meta?.source_url || id}
                                        >
                                          引用：{label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Message actions (visible icons at the bottom) */}
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1">
                                    <Button
                                              type="button"
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                              onClick={() => void copyMessageContent(m)}
                                              disabled={messageActionBusyId === m.id}
                                              title="复制"
                                            >
                                              {copiedMessageId === m.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>

                                    {m.role === "assistant" && (
                                      <>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                          disabled={sending || messageActionBusyId === m.id || m.id === "temp"}
                                          onClick={() => {
                                            setShowRegenerateConfirmId(m.id);
                                          }}
                                          title="重新回答"
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>

                                        <ConfirmDialog
                                          isOpen={showRegenerateConfirmId === m.id}
                                          onClose={() => setShowRegenerateConfirmId(null)}
                                          onConfirm={() => {
                                            void regenerateAssistantMessage(m.id);
                                            setShowRegenerateConfirmId(null);
                                          }}
                                          title="确认重新回答"
                                          description="重新回答将覆盖这条回答内容，是否继续？"
                                          confirmText="确认"
                                        />

                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className={cn(
                                            "h-7 w-7 rounded-lg",
                                            m.rating === 1 ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                                          )}
                                          disabled={messageActionBusyId === m.id || m.id === "temp"}
                                          onClick={() => {
                                            const cur = typeof m.rating === "number" ? m.rating : null;
                                            void setMessageRating(m.id, cur === 1 ? null : 1);
                                          }}
                                          title="喜欢"
                                        >
                                          <ThumbsUp className="h-4 w-4" />
                                        </Button>

                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className={cn(
                                            "h-7 w-7 rounded-lg",
                                            m.rating === -1 ? "text-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/30" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                                          )}
                                          disabled={messageActionBusyId === m.id || m.id === "temp"}
                                          onClick={() => {
                                            const cur = typeof m.rating === "number" ? m.rating : null;
                                            void setMessageRating(m.id, cur === -1 ? null : -1);
                                          }}
                                          title="不喜欢"
                                        >
                                          <ThumbsDown className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>

                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    disabled={sending || messageActionBusyId === m.id || m.id === "temp"}
                                    onClick={() => {
                                      setShowDeleteConfirmId(m.id);
                                    }}
                                    title="删除"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>

                                  <ConfirmDialog
                                    isOpen={showDeleteConfirmId === m.id}
                                    onClose={() => setShowDeleteConfirmId(null)}
                                    onConfirm={() => {
                                      void deleteMessage(m.id);
                                      setShowDeleteConfirmId(null);
                                    }}
                                    title="确认删除"
                                    description="确定删除这条消息吗？"
                                    confirmText="删除"
                                    variant="destructive"
                                  />
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Composer */}
                <div className="shrink-0 border-t border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:supports-[backdrop-filter]:bg-slate-900/60">
                  <div className="px-4 py-4 md:px-8">
                    <div className="mx-auto w-full max-w-3xl">
                      {!autoScrollEnabled && messages.length > 0 && (
                        <div className="mb-2 flex justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-white/80 dark:bg-slate-800/80"
                            onClick={() => {
                              autoScrollEnabledRef.current = true;
                              setAutoScrollEnabled(true);
                              scrollToBottom("smooth");
                            }}
                          >
                            回到最新
                          </Button>
                        </div>
                      )}

                      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                        <div className="p-3">
                          <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="输入你的问题（支持追问，Enter 发送）..."
                            className="min-h-[96px] border-slate-200/90 dark:border-slate-700/90 rounded-xl resize-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                              }
                            }}
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-slate-500 dark:text-slate-400"
                              onClick={handleNewConversation}
                              disabled={sending}
                            >
                              新对话
                            </Button>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-slate-500 dark:text-slate-400"
                                onClick={() => setDraft("")}
                                disabled={draft.length === 0 || sending}
                              >
                                清空
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600 text-white"
                                disabled={!canSend}
                                onClick={handleSend}
                              >
                                <Send className="h-4 w-4 mr-1" /> {sending ? "发送中..." : "发送"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8">
                <div className="mx-auto w-full max-w-3xl py-6">
                  {loadingTopicDetail ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">加载专题中...</div>
                  ) : !topicDetail ? (
                    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                      <div className="p-6">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">智能专题（P1）</div>
                            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                              点击左侧专题，查看条目时间线与专题报告；或先点击"生成/刷新专题"。
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900 dark:text-white truncate">
                                {topicDetail.topic.title || "未命名专题"}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {topicDetail.topic.updated_at ? `更新于 ${formatDay(topicDetail.topic.updated_at)}` : ""}
                                {typeof topicDetail.topic.member_count === "number" ? ` · ${topicDetail.topic.member_count} 条` : ""}
                              </div>

                              {Array.isArray(topicDetail.topic.keywords) && topicDetail.topic.keywords.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {topicDetail.topic.keywords.slice(0, 8).map((k) => (
                                    <span
                                      key={k}
                                      className="text-[11px] px-2 py-1 rounded-full border border-slate-200/90 dark:border-slate-700/90 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                    >
                                      {k}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="bg-white dark:bg-slate-900"
                                onClick={rebuildTopics}
                                disabled={rebuildingTopics}
                              >
                                <RefreshCw className={cn("h-4 w-4 mr-1", rebuildingTopics && "animate-spin")} /> 刷新
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="bg-white dark:bg-slate-900"
                                    disabled={topicActionBusyId === topicDetail.topic.id}
                                    title="专题操作"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    disabled={topicActionBusyId === topicDetail.topic.id}
                                    onClick={() => void togglePinTopic(topicDetail.topic)}
                                  >
                                    <Pin className="h-4 w-4 mr-2" />
                                    {Boolean(topicDetail.topic.pinned) ? "取消置顶" : "置顶"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={topicActionBusyId === topicDetail.topic.id}
                                    onClick={() => void toggleArchiveTopic(topicDetail.topic)}
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    {Boolean(topicDetail.topic.archived) ? "取消归档" : "归档"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={topicActionBusyId === topicDetail.topic.id}
                                    onClick={() => {
                                      setMergeSourceTopicId(null);
                                      setMergeDialogOpen(true);
                                    }}
                                  >
                                    <Share2 className="h-4 w-4 mr-2" />
                                    合并专题
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={topicActionBusyId === topicDetail.topic.id}
                                    onClick={() => void rewriteTopicReport(topicDetail.topic.id, "report_only")}
                                  >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    重写报告
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={topicActionBusyId === topicDetail.topic.id}
                                    onClick={() => void rewriteTopicReport(topicDetail.topic.id, "full")}
                                  >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    重写标题+报告
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </Card>

                      {topicVideos.length > 0 && (
                        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                          <div className="p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">视频预览</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{topicVideos.length} 条</div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {topicVideos.slice(0, 3).map((item) => {
                                const n = item.note;
                                const cover = n.cover_image_url?.trim() || "";
                                return (
                                  <div
                                    key={item.noteId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-3"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div
                                        className={cn(
                                          "h-10 w-16 rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800 shrink-0 overflow-hidden",
                                          cover ? "bg-cover bg-center" : "",
                                        )}
                                        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                                            {n.title || n.site_name || "视频"}
                                          </div>
                                          <div className="shrink-0 text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/70 rounded-full px-2 py-0.5">
                                            视频
                                          </div>
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {n.site_name || ""}{n.published_at ? ` · ${formatDay(n.published_at)}` : ""}
                                        </div>
                                      </div>
                                    </div>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="bg-white dark:bg-slate-900"
                                      onClick={() => openVideoPreviewForNote(n)}
                                      disabled={!n.source_url}
                                    >
                                      <Video className="h-4 w-4 mr-1" /> 预览
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>

                            {topicVideos.length > 3 && (
                              <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">仅展示 Top 3，可在时间轴中继续查看。</div>
                            )}
                          </div>
                        </Card>
                      )}

                      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                        <div className="p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">专题报告（Markdown）</div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="bg-white dark:bg-slate-900"
                              disabled={topicActionBusyId === topicDetail.topic.id}
                              onClick={() => void rewriteTopicReport(topicDetail.topic.id, "report_only")}
                            >
                              <Sparkles className="h-4 w-4 mr-1" /> 重写
                            </Button>
                          </div>
                          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {topicDetail.topic.summary_markdown?.trim()
                              ? topicDetail.topic.summary_markdown
                              : "暂无报告（可点击刷新专题生成）"}
                          </div>

                          {topicDetail.topic.summary_markdown &&
                            extractCitedNoteIds(topicDetail.topic.summary_markdown).length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {extractCitedNoteIds(topicDetail.topic.summary_markdown).map((id) => {
                                  const meta = noteMetaMap[id];
                                  const label = meta?.title || meta?.site_name || id.slice(0, 8);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      className="text-[11px] px-2 py-1 rounded-full border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                                      onClick={() => {
                                        window.location.href = `/notes/${id}`;
                                      }}
                                      title={meta?.source_url || id}
                                    >
                                      引用：{label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                      </Card>

                      {topicVideos.length > 0 && (
                        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                          <div className="p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">视频预览</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{topicVideos.length} 条</div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {topicVideos.slice(0, 3).map((item) => {
                                const n = item.note;
                                const cover = n.cover_image_url?.trim() || "";
                                return (
                                  <div
                                    key={item.noteId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-3"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div
                                        className={cn(
                                          "h-10 w-16 rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800 shrink-0 overflow-hidden",
                                          cover ? "bg-cover bg-center" : "",
                                        )}
                                        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                                            {n.title || n.site_name || "视频"}
                                          </div>
                                          <div className="shrink-0 text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/70 rounded-full px-2 py-0.5">
                                            视频
                                          </div>
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {n.site_name || ""}{n.published_at ? ` · ${formatDay(n.published_at)}` : ""}
                                        </div>
                                      </div>
                                    </div>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="bg-white dark:bg-slate-900"
                                      onClick={() => openVideoPreviewForNote(n)}
                                      disabled={!n.source_url}
                                    >
                                      <Video className="h-4 w-4 mr-1" /> 预览
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>

                            {topicVideos.length > 3 && (
                              <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">仅展示 Top 3，可在时间轴中继续查看。</div>
                            )}
                          </div>
                        </Card>
                      )}

                      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-none bg-white dark:bg-slate-900">
                        <div className="p-5">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">智能时间轴（事件节点）</div>

                          {Array.isArray(topicDetail.events) && topicDetail.events.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {topicDetail.events.slice(0, 80).map((ev) => {
                                const evidence = Array.isArray(ev.evidence) ? ev.evidence : [];
                                const best = evidence[0];

                                return (
                                  <div key={ev.id} className="rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                                          {ev.title || best?.note?.title || best?.note?.site_name || "事件节点"}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                          {formatDay(ev.event_time)} · {evidence.length} 条证据
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 rounded-full px-2 py-0.5">
                                        {typeof ev.importance === "number" ? `重要度 ${ev.importance.toFixed(2)}` : ""}
                                      </div>
                                    </div>

                                    {evidence.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {evidence.slice(0, 3).map((item) => (
                                          <div
                                            key={item.noteId}
                                            role="button"
                                            tabIndex={0}
                                            className="w-full text-left rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            onContextMenu={(e) => openTopicItemContextMenu(e, topicDetail.topic.id, item)}
                                            onClick={() => {
                                              window.location.href = `/notes/${item.noteId}`;
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                window.location.href = `/notes/${item.noteId}`;
                                              }
                                            }}
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <div className="min-w-0 flex-1 text-[12px] font-semibold text-slate-900 dark:text-white truncate">
                                                    {item.note?.title || item.note?.site_name || "无标题"}
                                                  </div>
                                                  {item.manual_state === "confirmed" && (
                                                    <div className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/70 rounded-full px-2 py-0.5">
                                                      已确认
                                                    </div>
                                                  )}
                                                  {item.note?.content_type === "video" && (
                                                    <div className="shrink-0 text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/70 rounded-full px-2 py-0.5">
                                                      视频
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              <div className="shrink-0 flex items-center gap-2">
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatDay(item.time)}</div>

                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <button
                                                      type="button"
                                                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                      onClick={(e) => e.stopPropagation()}
                                                      aria-label="条目操作"
                                                    >
                                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end" className="w-36">
                                                    {item.note?.content_type === "video" && item.note?.source_url ? (
                                                      <DropdownMenuItem
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openVideoPreviewForNote(item.note);
                                                        }}
                                                      >
                                                        <Video className="h-4 w-4 mr-2" />
                                                        视频预览
                                                      </DropdownMenuItem>
                                                    ) : null}
                                                    {item.note?.content_type === "video" && item.note?.source_url ? <DropdownMenuSeparator /> : null}

                                                    <DropdownMenuItem
                                                      disabled={topicActionBusyId === topicDetail.topic.id}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        void topicMemberAction(topicDetail.topic.id, item.noteId, "confirm");
                                                      }}
                                                    >
                                                      <Pin className="h-4 w-4 mr-2" />
                                                      确认归类
                                                    </DropdownMenuItem>

                                                    <DropdownMenuItem
                                                      disabled={topicActionBusyId === topicDetail.topic.id}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openAddToTopicDialog(item.noteId);
                                                      }}
                                                    >
                                                      <Plus className="h-4 w-4 mr-2" />
                                                      加入到其他专题
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      disabled={topicActionBusyId === topicDetail.topic.id}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openCorrectTimeDialog(topicDetail.topic.id, item.noteId, item.event_time || item.time);
                                                      }}
                                                    >
                                                      <Pencil className="h-4 w-4 mr-2" />
                                                      纠错时间
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />

                                                    <DropdownMenuItem
                                                      disabled={topicActionBusyId === topicDetail.topic.id}
                                                      className="text-red-600 focus:text-red-600"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        void topicMemberAction(topicDetail.topic.id, item.noteId, "remove");
                                                      }}
                                                    >
                                                      <Trash2 className="h-4 w-4 mr-2" />
                                                      移出专题
                                                    </DropdownMenuItem>
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>
                                            </div>
                                            {item.note?.excerpt && (
                                              <div className="mt-1 text-[12px] text-slate-600 line-clamp-2">{item.note.excerpt}</div>
                                            )}
                                          </div>
                                        ))}

                                        {evidence.length > 3 && (
                                          <div className="text-[11px] text-slate-400 dark:text-slate-500 px-1">还有 {evidence.length - 3} 条证据（先展示 Top 3）</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {topicDetail.timeline.slice(0, 120).map((item) => {
                                const n = item.note;
                                return (
                                  <div
                                    key={item.noteId}
                                    role="button"
                                    tabIndex={0}
                                    className="w-full text-left rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors p-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    onContextMenu={(e) => openTopicItemContextMenu(e, topicDetail.topic.id, item)}
                                    onClick={() => {
                                      window.location.href = `/notes/${item.noteId}`;
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        window.location.href = `/notes/${item.noteId}`;
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="min-w-0 flex-1 text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                                            {n?.title || n?.site_name || "无标题"}
                                          </div>
                                          {item.manual_state === "confirmed" && (
                                            <div className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/70 rounded-full px-2 py-0.5">
                                              已确认
                                            </div>
                                          )}
                                          {n?.content_type === "video" && (
                                            <div className="shrink-0 text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/70 rounded-full px-2 py-0.5">
                                              视频
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="shrink-0 flex items-center gap-2">
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatDay(item.time)}</div>

                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              type="button"
                                              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                              onClick={(e) => e.stopPropagation()}
                                              aria-label="条目操作"
                                            >
                                              <MoreHorizontal className="h-3.5 w-3.5" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-36">
                                            {n?.content_type === "video" && n?.source_url ? (
                                              <DropdownMenuItem
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openVideoPreviewForNote(n);
                                                }}
                                              >
                                                <Video className="h-4 w-4 mr-2" />
                                                视频预览
                                              </DropdownMenuItem>
                                            ) : null}
                                            {n?.content_type === "video" && n?.source_url ? <DropdownMenuSeparator /> : null}

                                            <DropdownMenuItem
                                              disabled={topicActionBusyId === topicDetail.topic.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void topicMemberAction(topicDetail.topic.id, item.noteId, "confirm");
                                              }}
                                            >
                                              <Pin className="h-4 w-4 mr-2" />
                                              确认归类
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                              disabled={topicActionBusyId === topicDetail.topic.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openAddToTopicDialog(item.noteId);
                                              }}
                                            >
                                              <Plus className="h-4 w-4 mr-2" />
                                              加入到其他专题
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              disabled={topicActionBusyId === topicDetail.topic.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openCorrectTimeDialog(topicDetail.topic.id, item.noteId, item.event_time || item.time);
                                              }}
                                            >
                                              <Pencil className="h-4 w-4 mr-2" />
                                              纠错时间
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />

                                            <DropdownMenuItem
                                              disabled={topicActionBusyId === topicDetail.topic.id}
                                              className="text-red-600 focus:text-red-600"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void topicMemberAction(topicDetail.topic.id, item.noteId, "remove");
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              移出专题
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                    {n?.excerpt && (
                                      <div className="mt-1 text-[12px] text-slate-600 dark:text-slate-400 line-clamp-2">{n.excerpt}</div>
                                    )}
                                  </div>
                                );
                              })}

                              {topicDetail.timeline.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">暂无条目</div>}
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenu ? (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="absolute min-w-[220px] rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-lg p-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.note?.content_type === "video" && contextMenu.note?.source_url ? (
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                onClick={() => {
                  setContextMenu(null);
                  openVideoPreviewForNote(contextMenu.note);
                }}
              >
                <Video className="h-4 w-4" /> 视频预览
              </button>
            ) : null}

            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              onClick={() => {
                setContextMenu(null);
                void topicMemberAction(contextMenu.topicId, contextMenu.noteId, "confirm");
              }}
            >
              <Pin className="h-4 w-4" /> 确认归类
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              onClick={() => {
                setContextMenu(null);
                openAddToTopicDialog(contextMenu.noteId);
              }}
            >
              <Plus className="h-4 w-4" /> 加入到其他专题
            </button>

            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              onClick={() => {
                setContextMenu(null);
                openCorrectTimeDialog(contextMenu.topicId, contextMenu.noteId, contextMenu.timeIso ?? null);
              }}
            >
              <Pencil className="h-4 w-4" /> 纠错时间
            </button>

            <div className="my-1 h-px bg-slate-200/80 dark:bg-slate-700/80" />

            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400"
              onClick={() => {
                setContextMenu(null);
                void topicMemberAction(contextMenu.topicId, contextMenu.noteId, "remove");
              }}
            >
              <Trash2 className="h-4 w-4" /> 移出专题
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
