"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  StickyNote,
  Trash2,
  MoreHorizontal,
  Pin,
  PinOff,
  Copy,
  Link2,
  Download,
  Share2,
  MessageSquare,
  X,
  Quote,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { markNoteAnnotationsDirty } from "@/lib/noteSync";

interface HighlightWithAnnotation {
  id: string;
  quote: string;
  color: string;
  created_at: string;
  range_start?: number | null;
  range_end?: number | null;
  range_data: any;
  timecode?: number | null;
  screenshot_url?: string | null;
  annotations: {
    id: string;
    content: string;
    created_at: string;
    timecode?: number | null;
    screenshot_url?: string | null;
  }[];
}

const COLOR_MAP: Record<string, string> = {
  yellow: '#fef08a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
};

interface AnnotationListProps {
  noteId: string;
  isCompact?: boolean;
  onExpand?: () => void;
}

export function AnnotationList({ noteId, isCompact = false, onExpand }: AnnotationListProps) {
  const [items, setItems] = useState<HighlightWithAnnotation[]>([]);
  const itemsRef = useRef<HighlightWithAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [floatingIds, setFloatingIds] = useState<Set<string>>(new Set());
  const [quoteMaterialIdByAnnotationId, setQuoteMaterialIdByAnnotationId] = useState<Map<string, string>>(new Map());
  const [quoteMaterialBusyAnnotationIds, setQuoteMaterialBusyAnnotationIds] = useState<Set<string>>(new Set());
  const [extractingQuotes, setExtractingQuotes] = useState(false);
  // 笔记草稿：始终在卡片内用 textarea 编辑，不再弹出“保存/取消”
  const [noteDrafts, setNoteDrafts] = useState<Map<string, string>>(new Map());
  const noteDraftsRef = useRef<Map<string, string>>(new Map());
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const focusedNoteIdRef = useRef<string | null>(null);
  const [savingNoteIds, setSavingNoteIds] = useState<Set<string>>(new Set());
  const autoSaveTimersRef = useRef<Map<string, number>>(new Map());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [floatingPositions, setFloatingPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [floatingZIndex, setFloatingZIndex] = useState<Map<string, number>>(new Map());
  const zIndexCounter = useRef<number>(10000); // 起始 z-index 值，确保足够大
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastAddedHighlightId = useRef<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 滚动到指定高亮的辅助函数
  const scrollToHighlight = useCallback((highlightId: string) => {
    // 确保 DOM 已渲染
    requestAnimationFrame(() => {
      const cardElement = cardRefs.current.get(highlightId);
      if (cardElement) {
        cardElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
        // 添加高亮效果
        cardElement.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        cardElement.style.transform = 'scale(1.02)';
        cardElement.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        cardElement.style.zIndex = '10';
        cardElement.style.borderColor = '#94a3b8'; // slate-400
        
        setTimeout(() => {
          cardElement.style.transform = '';
          cardElement.style.boxShadow = '';
          cardElement.style.zIndex = '';
          cardElement.style.borderColor = '';
        }, 800);
      }
    });
  }, []);

  // 监听 pendingScrollId 和 items 变化以触发滚动
  useEffect(() => {
    if (pendingScrollId && items.length > 0) {
      // 检查 ref 是否存在
      const el = cardRefs.current.get(pendingScrollId);
      if (el) {
        scrollToHighlight(pendingScrollId);
        setPendingScrollId(null);
      } else {
        // 如果还不存在，可能需要等待渲染，设置一个短暂延迟重试
        const timer = setTimeout(() => {
          const retryEl = cardRefs.current.get(pendingScrollId);
          if (retryEl) {
            scrollToHighlight(pendingScrollId);
            setPendingScrollId(null);
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [pendingScrollId, items, scrollToHighlight]);

  // Handle Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFloatingIds(new Set());
        setFloatingPositions(new Map());
        setFloatingZIndex(new Map());
        setShowDeleteConfirm(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const loadQuoteMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/quote-materials?note_id=${encodeURIComponent(noteId)}&limit=200`, { method: "GET" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) return;

      const next = new Map<string, string>();
      for (const it of Array.isArray(json.items) ? json.items : []) {
        if (typeof it?.annotation_id === "string" && typeof it?.id === "string") {
          next.set(it.annotation_id, it.id);
        }
      }
      setQuoteMaterialIdByAnnotationId(next);
    } catch {
      // ignore
    }
  }, [noteId]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("highlights")
      .select("*, annotations(id, content, created_at)")
      .eq("note_id", noteId);

    if (!error && data) {
      // 按正文位置排序（range_start），如果没有则按创建时间
      const sorted = (data as HighlightWithAnnotation[]).sort((a, b) => {
        const aStart = a.range_start ?? a.range_data?.globalStart ?? 0;
        const bStart = b.range_start ?? b.range_data?.globalStart ?? 0;
        if (aStart !== bStart) return aStart - bStart;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      
      setItems(sorted);

      // 同步草稿：未聚焦的卡片用最新数据库内容初始化/刷新；聚焦中的不覆盖，避免输入被打断
      setNoteDrafts((prev) => {
        const next = new Map(prev);
        for (const it of sorted) {
          if (focusedNoteIdRef.current === it.id) continue;
          const content = it.annotations?.[0]?.content ?? "";
          // 如果之前没草稿，就初始化；否则不强行覆盖（避免覆盖用户输入）
          if (!next.has(it.id)) {
            next.set(it.id, content);
          }
        }
        return next;
      });
      
      // 如果有批注，通知父组件打开侧边栏
      if (sorted.length > 0) {
        window.dispatchEvent(new CustomEvent("reader:has-annotations", { detail: { count: sorted.length } }));
      }
      
      // 如果之前有记录最后添加的高亮ID，在刷新后定位到它
      if (lastAddedHighlightId.current) {
        const targetId = lastAddedHighlightId.current;
        // 检查新数据中是否包含这个ID
        if (sorted.some(item => item.id === targetId)) {
          setPendingScrollId(targetId);
          lastAddedHighlightId.current = null;
        }
      }
    }
    setLoading(false);
  }, [noteId]);

  // 乐观更新：立即添加新创建的高亮
  useEffect(() => {
    const handleNewHighlight = (e: any) => {
      const newHighlight = e.detail?.highlight;
      if (newHighlight) {
        // 记录最后添加的高亮ID
        lastAddedHighlightId.current = newHighlight.id;
        
        // 立即添加到列表顶部（乐观更新）
        setItems((prev) => {
          // 检查是否已存在，避免重复
          if (prev.some(item => item.id === newHighlight.id)) {
            return prev;
          }
          // 转换为 HighlightWithAnnotation 格式
          const newItem: HighlightWithAnnotation = {
            ...newHighlight,
            annotations: newHighlight.annotations || [],
          };
          // 插入到正确位置（按 range_start 排序）
          const sorted = [...prev, newItem].sort((a, b) => {
            const aStart = a.range_start ?? a.range_data?.globalStart ?? 0;
            const bStart = b.range_start ?? b.range_data?.globalStart ?? 0;
            if (aStart !== bStart) return aStart - bStart;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          return sorted;
        });
        
        // 设置待滚动ID，等待渲染完成后触发滚动
        setPendingScrollId(newHighlight.id);
      }
    };

    window.addEventListener("reader:new-highlight", handleNewHighlight);
    return () => window.removeEventListener("reader:new-highlight", handleNewHighlight);
  }, [scrollToHighlight]);

  // 监听滚动到指定高亮的事件（用于批注保存后定位）
  useEffect(() => {
    const handleScrollToHighlight = (e: any) => {
      const highlightId = e.detail?.highlightId;
      if (highlightId) {
        setPendingScrollId(highlightId);
      }
    };

    window.addEventListener("reader:scroll-to-highlight", handleScrollToHighlight);
    return () => window.removeEventListener("reader:scroll-to-highlight", handleScrollToHighlight);
  }, [scrollToHighlight]);

  useEffect(() => {
    loadData();
    void loadQuoteMaterials();
    
    // 监听刷新事件（包括新建高亮）
    const handleRefresh = () => {
      loadData();
      void loadQuoteMaterials();
    };
    window.addEventListener("reader:refresh-highlights", handleRefresh);
    return () => window.removeEventListener("reader:refresh-highlights", handleRefresh);
  }, [noteId, loadData, loadQuoteMaterials]);

  const toggleQuoteMaterialForAnnotation = useCallback(
    async (annotationId: string) => {
      if (!annotationId) return;
      setQuoteMaterialBusyAnnotationIds((prev) => new Set(prev).add(annotationId));
      try {
        const existingId = quoteMaterialIdByAnnotationId.get(annotationId);
        if (existingId) {
          const res = await fetch(`/api/quote-materials?id=${encodeURIComponent(existingId)}`, { method: "DELETE" });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.success) {
            toast.error(json?.error || "取消金句素材失败");
            return;
          }
          setQuoteMaterialIdByAnnotationId((prev) => {
            const next = new Map(prev);
            next.delete(annotationId);
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
          setQuoteMaterialIdByAnnotationId((prev) => new Map(prev).set(annotationId, id));
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

  const extractQuotesForNote = useCallback(async () => {
    if (!noteId) return;
    setExtractingQuotes(true);
    try {
      const res = await fetch("/api/quote-materials/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: noteId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        toast.error(json?.error || "自动提取失败");
        return;
      }
      toast.success(`已提取并入库 ${json?.inserted ?? 0} 条金句`);
    } finally {
      setExtractingQuotes(false);
    }
  }, [noteId]);

  const handleJump = (highlightId: string) => {
    if (floatingIds.has(highlightId)) return;
    // 关键修复：跨 <p> 的高亮会被拆成多个 <mark data-highlight-id="...">，
    // 且它们的 id 可能是 highlight-<id>-<i>，这会导致按 id 查找失败。
    const el =
      (document.querySelector(`[data-highlight-id="${highlightId}"]`) as HTMLElement | null) ??
      (document.getElementById(`highlight-${highlightId}`) as HTMLElement | null);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'opacity 0.2s';
      el.style.opacity = '0.4';
      setTimeout(() => {
        el.style.opacity = '1';
      }, 300);
    }
  };

  const handleDelete = async (highlightId: string) => {
    setShowDeleteConfirm(highlightId);
  };

  const actualDelete = async () => {
    if (!showDeleteConfirm) return;
    const highlightId = showDeleteConfirm;
    setIsDeleting(true);
    
    const supabase = createClient();
    const { error } = await supabase.from("highlights").delete().eq("id", highlightId);
    
    if (!error) {
      setItems(items.filter(item => item.id !== highlightId));
      setFloatingIds(prev => {
        const next = new Set(prev);
        next.delete(highlightId);
        return next;
      });
      window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
      toast.success("已删除");
    } else {
      toast.error("删除失败");
    }
    
    setIsDeleting(false);
    setShowDeleteConfirm(null);
  };

  const handleColorChange = async (highlightId: string, newColor: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("highlights").update({ color: newColor }).eq("id", highlightId);
    
    if (!error) {
      setItems(items.map(item => item.id === highlightId ? { ...item, color: newColor } : item));
      window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
    }
  };

  const handleTogglePin = (highlightId: string, position?: { x: number; y: number }, shouldPromoteZIndex?: boolean) => {
    setFloatingIds(prev => {
      const next = new Set(prev);
      if (next.has(highlightId)) {
        // 如果卡片已经打开
        if (shouldPromoteZIndex) {
          // 从 Compact 模式点击小方块：提升 z-index，不关闭
          setFloatingZIndex(prevZ => {
            const nextZ = new Map(prevZ);
            zIndexCounter.current += 1;
            nextZ.set(highlightId, zIndexCounter.current);
            return nextZ;
          });
          
          // 如果有新位置，更新位置（例如从列表打开后，再点击小方块，应移动到方块旁）
          if (position) {
            setFloatingPositions(prevPos => {
              const nextPos = new Map(prevPos);
              nextPos.set(highlightId, position);
              return nextPos;
            });
          }
          
          return next; // 不关闭，只是提升层级和更新位置
        } else {
          // 从批注列表点击 Pin 按钮：正常关闭
          next.delete(highlightId);
          // 清除位置和 z-index 信息
          setFloatingPositions(prevPos => {
            const nextPos = new Map(prevPos);
            nextPos.delete(highlightId);
            return nextPos;
          });
          setFloatingZIndex(prevZ => {
            const nextZ = new Map(prevZ);
            nextZ.delete(highlightId);
            return nextZ;
          });
        }
      } else {
        // 打开新卡片
        next.add(highlightId);
        // 存储位置信息
        if (position) {
          setFloatingPositions(prevPos => {
            const nextPos = new Map(prevPos);
            nextPos.set(highlightId, position);
            return nextPos;
          });
        } else {
          // 如果没有位置信息（从批注列表打开），使用屏幕中央位置
          if (typeof window !== 'undefined') {
            setFloatingPositions(prevPos => {
              const nextPos = new Map(prevPos);
              nextPos.set(highlightId, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
              });
              return nextPos;
            });
          }
        }
        // 设置新的 z-index
        setFloatingZIndex(prevZ => {
          const nextZ = new Map(prevZ);
          zIndexCounter.current += 1;
          nextZ.set(highlightId, zIndexCounter.current);
          return nextZ;
        });
      }
      return next;
    });
  };

  // 关闭浮动卡片
  const handleCloseFloating = (highlightId: string) => {
    setFloatingIds(prev => {
      const next = new Set(prev);
      next.delete(highlightId);
      return next;
    });
    // 清除位置和 z-index 信息
    setFloatingPositions(prevPos => {
      const nextPos = new Map(prevPos);
      nextPos.delete(highlightId);
      return nextPos;
    });
    setFloatingZIndex(prevZ => {
      const nextZ = new Map(prevZ);
      nextZ.delete(highlightId);
      return nextZ;
    });
  };

  const saveNote = useCallback(async (highlightId: string, content: string) => {
    const supabase = createClient();
    const item = itemsRef.current.find((i) => i.id === highlightId);
    const annotation = item?.annotations?.[0];
    const trimmed = content.trim();

    setSavingNoteIds((prev) => new Set(prev).add(highlightId));

    try {
      if (annotation) {
        const { error } = await supabase
          .from("annotations")
          .update({ content: trimmed })
          .eq("id", annotation.id);
        if (!error) {
          markNoteAnnotationsDirty(noteId);
          // 乐观更新
          setItems((prev) =>
            prev.map((it) =>
              it.id === highlightId
                ? {
                    ...it,
                    annotations: it.annotations?.length
                      ? [{ ...it.annotations[0], content: trimmed }, ...it.annotations.slice(1)]
                      : it.annotations,
                  }
                : it
            )
          );
        }
      } else {
        // 没有 annotation 且内容为空：不创建记录
        if (!trimmed) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("annotations")
          .insert({
            user_id: user.id,
            note_id: noteId,
            highlight_id: highlightId,
            content: trimmed,
          })
          .select("id, content, created_at")
          .single();

        if (!error && data) {
          markNoteAnnotationsDirty(noteId);
          setItems((prev) =>
            prev.map((it) =>
              it.id === highlightId ? { ...it, annotations: [data] } : it
            )
          );
        }
      }
    } finally {
      setSavingNoteIds((prev) => {
        const next = new Set(prev);
        next.delete(highlightId);
        return next;
      });
    }
  }, [noteId]);

  const scheduleAutoSave = useCallback(
    (highlightId: string, content: string) => {
      // Clear previous timer
      const prev = autoSaveTimersRef.current.get(highlightId);
      if (typeof prev === "number") {
        window.clearTimeout(prev);
        autoSaveTimersRef.current.delete(highlightId);
      }

      const timer = window.setTimeout(() => {
        autoSaveTimersRef.current.delete(highlightId);
        void saveNote(highlightId, content);
      }, 800);
      autoSaveTimersRef.current.set(highlightId, timer);
    },
    [saveNote],
  );

  const flushPendingSaves = useCallback(() => {
    // Clear timers and do a best-effort save for the latest drafts
    for (const [highlightId, timer] of autoSaveTimersRef.current.entries()) {
      window.clearTimeout(timer);
      autoSaveTimersRef.current.delete(highlightId);
      const content = noteDraftsRef.current.get(highlightId) ?? "";
      void saveNote(highlightId, content);
    }

    const focused = focusedNoteIdRef.current;
    if (focused) {
      const content = noteDraftsRef.current.get(focused) ?? "";
      void saveNote(focused, content);
    }
  }, [saveNote]);

  useEffect(() => {
    noteDraftsRef.current = noteDrafts;
  }, [noteDrafts]);

  useEffect(() => {
    // Flush drafts when navigating away (prevents count mismatch due to unsaved notes)
    const onPageHide = () => flushPendingSaves();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flushPendingSaves();
    };
  }, [flushPendingSaves]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCompactClick = (highlightId: string, event: React.MouseEvent<HTMLDivElement>) => {
    // 获取点击元素的位置
    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2, // 方块中心
      y: rect.top + rect.height / 2
    };
    
    // 检查卡片是否已经打开
    const isAlreadyOpen = floatingIds.has(highlightId);
    
    if (!isAlreadyOpen) {
      // 打开新卡片
      handleTogglePin(highlightId, position, false);
    } else {
      // 如果已打开，提升 z-index 并更新位置
      handleTogglePin(highlightId, position, true);
    }
    
    // 滚动正文到对应的高亮区域
    handleJump(highlightId);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        加载批注中...
      </div>
    );
  }

  if (items.length === 0) {
    if (isCompact) return null;
    return (
      <div className="p-6 text-center">
        <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">暂无批注或高亮</p>
        <p className="text-xs text-muted-foreground mt-1">
          选中文字即可添加高亮与批注
        </p>
      </div>
    );
  }

  return (
    <>
      {isCompact ? (
        <div className="flex flex-col items-center gap-3 py-4">
          {items.map((item) => {
            const hexColor = COLOR_MAP[item.color] || item.color || '#fef08a';
            const hasAnnotation = item.annotations && item.annotations.length > 0;
            
            return (
              <motion.div
                key={item.id}
                className="w-6 h-6 rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
                style={{ backgroundColor: hexColor }}
                whileHover={{ 
                  scale: 1.15,
                  borderRadius: "6px",
                }}
                onClick={(e) => handleCompactClick(item.id, e)}
              >
                {hasAnnotation && (
                  <MessageSquare className="w-3.5 h-3.5 text-slate-900/30" strokeWidth={2.5} />
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-400">共 {items.length} 条</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl"
              disabled={extractingQuotes}
              onClick={(e) => {
                e.stopPropagation();
                void extractQuotesForNote();
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              自动提取金句
            </Button>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) {
                  cardRefs.current.set(item.id, el);
                } else {
                  cardRefs.current.delete(item.id);
                }
              }}
            >
              <AnnotationCard
                item={item}
                isFloating={floatingIds.has(item.id)}
                onJump={handleJump}
                onDelete={handleDelete}
                onColorChange={handleColorChange}
                onTogglePin={handleTogglePin}
                quoteMaterialId={
                  item.annotations?.[0]?.id ? quoteMaterialIdByAnnotationId.get(item.annotations[0].id) || null : null
                }
                quoteMaterialBusy={item.annotations?.[0]?.id ? quoteMaterialBusyAnnotationIds.has(item.annotations[0].id) : false}
                onToggleQuoteMaterial={(annotationId: string) => void toggleQuoteMaterialForAnnotation(annotationId)}
                noteValue={noteDrafts.get(item.id) ?? item.annotations?.[0]?.content ?? ""}
                isNoteSaving={savingNoteIds.has(item.id)}
                onNoteFocus={() => {
                  focusedNoteIdRef.current = item.id;
                  setFocusedNoteId(item.id);
                }}
                onNoteChange={(val: string) => {
                  setNoteDrafts((prev) => {
                    const next = new Map(prev);
                    next.set(item.id, val);
                    return next;
                  });
                  scheduleAutoSave(item.id, val);
                }}
                onNoteBlur={() => {
                  const content = noteDrafts.get(item.id) ?? item.annotations?.[0]?.content ?? "";
                  focusedNoteIdRef.current = null;
                  setFocusedNoteId((cur) => (cur === item.id ? null : cur));
                  const pending = autoSaveTimersRef.current.get(item.id);
                  if (typeof pending === "number") {
                    window.clearTimeout(pending);
                    autoSaveTimersRef.current.delete(item.id);
                  }
                  void saveNote(item.id, content);
                }}
                onCopy={copyToClipboard}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Floating Cards Portal - 在两种模式下都渲染 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {items.filter(i => floatingIds.has(i.id)).map(item => {
            const position = floatingPositions.get(item.id);
            const zIndex = floatingZIndex.get(item.id) || 10000; // 使用足够大的默认值
            return (
              <FloatingCard
                key={`float-${item.id}`}
                item={item}
                position={position}
                zIndex={zIndex}
                onClose={() => handleCloseFloating(item.id)}
                onColorChange={handleColorChange}
                onDelete={handleDelete}
                onCopy={copyToClipboard}
                onClick={() => {
                  // 点击卡片时提升层级
                  const currentPosition = floatingPositions.get(item.id);
                  handleTogglePin(item.id, currentPosition, true);
                }}
              />
            );
          })}
        </AnimatePresence>,
        document.body
      )}

      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={actualDelete}
        title="确认删除"
        description="确定要删除这条高亮及关联批注吗？"
        confirmText="删除"
        variant="destructive"
        loading={isDeleting}
      />
    </>
  );
}

function AnnotationCard({ 
  item, isFloating,
  onJump, onDelete, onColorChange, onTogglePin, 
  quoteMaterialId, quoteMaterialBusy, onToggleQuoteMaterial,
  noteValue, isNoteSaving, onNoteFocus, onNoteChange, onNoteBlur, onCopy
}: any) {
  const annotation = item.annotations?.[0];
  const hexColor = COLOR_MAP[item.color] || item.color || '#fef08a';
  const annotationId = annotation?.id || "";
  const isQuoteMaterial = !!quoteMaterialId;
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const autosizeNote = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    // 关键修复：textarea 的 scrollHeight 在元素“当前高度很大”时会等于当前高度，
    // 直接用 scrollHeight 会导致单行也被锁定成大高度（你看到的大留白就是这个）。
    // 采用更稳的 autosize：先把高度压到 0，再读取 scrollHeight，再设置目标高度。
    el.style.height = "0px";

    const cs = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(cs.lineHeight || "0") || 0;
    const paddingTop = Number.parseFloat(cs.paddingTop || "0") || 0;
    const paddingBottom = Number.parseFloat(cs.paddingBottom || "0") || 0;
    const minHeight = Math.max(0, lineHeight + paddingTop + paddingBottom);

    const next = Math.max(el.scrollHeight, minHeight);
    el.style.height = `${next}px`;
  }, []);

  // 关键：在 paint 前修正高度，避免“页面初始加载很高，聚焦后才缩回”的闪烁/滞后
  useLayoutEffect(() => {
    autosizeNote(noteRef.current);
  }, [noteValue, autosizeNote]);

  // 布局/字体加载完成后再跑一次（字体切换/宽度变化会影响换行 -> scrollHeight）
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;

    let cancelled = false;
    const run = () => {
      if (!cancelled) autosizeNote(el);
    };

    const id1 = requestAnimationFrame(run);
    const id2 = requestAnimationFrame(run);

    // 字体加载完成后再算一次，避免 line-height 变化导致初始高度不准
    const fonts: any = (document as any).fonts;
    if (fonts?.ready?.then) {
      fonts.ready.then(run).catch(() => {});
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [noteValue, autosizeNote]);

  // 侧栏宽度/容器尺寸变化时（展开/收起、窗口 resize），重新计算高度
  useEffect(() => {
    const el = noteRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    resizeObserverRef.current?.disconnect();
    const ro = new ResizeObserver(() => {
      autosizeNote(el);
    });
    ro.observe(el);
    resizeObserverRef.current = ro;

    return () => {
      ro.disconnect();
      if (resizeObserverRef.current === ro) resizeObserverRef.current = null;
    };
  }, [autosizeNote]);

  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all duration-300 overflow-hidden",
        isFloating ? "opacity-40 grayscale pointer-events-none" : "hover:shadow-[0_12px_24px_rgb(0,0,0,0.04)] cursor-pointer"
      )}
      onClick={() => !isFloating && onJump(item.id)}
    >
      {/* 头部：操作按钮 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-50/50 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button 
                className="w-3.5 h-3.5 rounded-full hover:scale-110 transition-transform" 
                style={{ backgroundColor: hexColor }}
                onClick={(e) => e.stopPropagation()}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[120px] p-1.5 flex gap-1.5">
              {Object.entries(COLOR_MAP).map(([name, hex]) => (
                <button
                  key={name}
                  className="w-5 h-5 rounded-full border border-slate-100 dark:border-slate-700"
                  style={{ backgroundColor: hex }}
                  onClick={() => onColorChange(item.id, name)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-0.5">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-slate-500 hover:text-red-500"
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={e => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCopy(item.quote)}><Copy className="mr-2 h-4 w-4" /> 复制内容</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCopy(window.location.href)}><Link2 className="mr-2 h-4 w-4" /> 复制链接</DropdownMenuItem>
              {annotationId ? (
                <DropdownMenuItem disabled={quoteMaterialBusy} onClick={() => onToggleQuoteMaterial(annotationId)}>
                  <Quote className="mr-2 h-4 w-4" /> {isQuoteMaterial ? "取消金句素材" : "设为金句素材"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> 导出 TXT</DropdownMenuItem>
              <DropdownMenuItem><Share2 className="mr-2 h-4 w-4" /> 分享</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-slate-500 hover:text-slate-700"
            onClick={(e) => { e.stopPropagation(); onTogglePin(item.id); }}
          >
            {isFloating ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="p-4 pt-3">
        {/* 视频信息 (如果有) */}
        {(item.timecode !== null || item.screenshot_url) && (
          <div className="mb-3 flex items-start gap-2">
            {item.screenshot_url && (
              <div className="w-20 h-12 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700">
                <img src={item.screenshot_url} alt="Screenshot" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              {item.timecode !== null && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("video:seek", { detail: { time: item.timecode } }));
                  }}
                  className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded w-fit hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  {Math.floor(item.timecode / 60).toString().padStart(2, "0")}:
                  {Math.floor(item.timecode % 60).toString().padStart(2, "0")}
                </button>
              )}
            </div>
          </div>
        )}

        <div 
          className="bg-slate-50/80 dark:bg-slate-800/80 rounded-lg p-3 border-l-[3px] mb-4"
          style={{ borderLeftColor: hexColor }}
        >
          <blockquote className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-6">
            {item.quote}
          </blockquote>
        </div>

        {/* 笔记：始终是 textarea，focus 可输入，blur 自动保存 */}
        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
          {/* 注意：这里不用共享的 <Textarea />（它自带 min-h-[80px]），否则单行也会有大留白 */}
          <textarea
            ref={(el) => {
              noteRef.current = el;
              // 关键：mount 时立刻矫正高度，避免出现“初始高度被锁成很大”的情况
              autosizeNote(el);
            }}
            value={noteValue}
            placeholder="添加笔记..."
            rows={1}
            onFocus={(e) => {
              e.stopPropagation();
              onNoteFocus?.();
              // 聚焦时也确保高度正确
              autosizeNote(noteRef.current);
            }}
            onChange={(e) => {
              onNoteChange?.(e.target.value);
              autosizeNote(e.currentTarget);
            }}
            onBlur={() => onNoteBlur?.()}
            className={cn(
              // 默认只展示一行高度 + 无边框（更像 inline note）
              // 用 leading-6 + py-1 让一行时高度更紧凑，同时 autosize 会根据 scrollHeight 增长
              "w-full text-[14px] leading-6 min-h-0 py-1 px-1 border-0 shadow-none bg-transparent resize-none overflow-hidden outline-none focus:outline-none dark:text-slate-200 dark:placeholder-slate-500",
              isNoteSaving ? "opacity-70" : ""
            )}
          />
          {/* 轻量提示：保存中 */}
          {isNoteSaving && (
            <div className="text-[10px] text-slate-300 px-1">保存中...</div>
          )}
        </div>

        <div className="mt-2 px-1 text-[10px] text-slate-300">
          {new Date(item.created_at).toLocaleString("zh-CN", {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}

function FloatingCard({ item, position, zIndex = 10000, onClick, onClose, onColorChange, onDelete, onCopy }: any) {
  const hexColor = COLOR_MAP[item.color] || item.color || '#fef08a';
  const annotation = item.annotations?.[0];

  // 计算卡片位置：卡片的右上角与小方块的右边距保持在20px以内
  const cardStyle = position && typeof window !== 'undefined'
    ? (() => {
        const cardWidth = 320; // 卡片宽度
        const spacing = 20; // 右边距
        const squareSize = 24; // 小方块大小 (w-6 h-6 = 24px)
        
        // 计算卡片右上角的位置
        // 小方块中心 x + 方块宽度的一半 + 间距 = 卡片右上角的 x
        let left = position.x + squareSize / 2 + spacing;
        // 小方块中心 y - 方块高度的一半 = 卡片右上角的 y（对齐方块顶部）
        let top = position.y - squareSize / 2;
        
        // 检查右边界：如果超出，则显示在小方块左侧
        if (left + cardWidth > window.innerWidth) {
          left = position.x - squareSize / 2 - spacing - cardWidth;
        }
        
        // 检查左边界：确保不超出
        if (left < 0) {
          left = spacing;
        }
        
        // 检查上边界：确保不超出
        if (top < 0) {
          top = spacing;
        }
        
        // 检查下边界：如果超出，向上调整
        const cardHeight = 200; // 估算卡片高度
        if (top + cardHeight > window.innerHeight) {
          top = window.innerHeight - cardHeight - spacing;
        }
        
        return {
          position: 'fixed' as const,
          left: `${left}px`,
          top: `${top}px`,
          zIndex: zIndex
        };
      })()
    : { 
        position: 'fixed' as const,
        left: '50%', 
        top: '50%', 
        transform: 'translate(-50%, -50%)',
        zIndex: zIndex 
      };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      style={{
        ...cardStyle,
        zIndex: zIndex, // 确保 z-index 正确应用
      }}
      onClick={(e) => {
        // 点击卡片时提升层级（但排除按钮点击）
        if (onClick && !(e.target as HTMLElement).closest('button')) {
          onClick();
        }
      }}
      className="fixed w-[320px] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 overflow-hidden cursor-move relative"
    >
      {/* 关闭按钮 - 右上角 */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-7 w-7 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 z-10" 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hexColor }} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Floating Note</span>
        </div>
      </div>
      
      <div className="p-5">
        {/* 视频信息 (如果有) */}
        {(item.timecode !== null || item.screenshot_url) && (
          <div className="mb-4 flex items-center gap-3">
            {item.screenshot_url && (
              <img src={item.screenshot_url} alt="Screenshot" className="w-24 h-14 rounded-lg object-cover shadow-sm border border-slate-100 dark:border-slate-700" />
            )}
            {item.timecode !== null && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("video:seek", { detail: { time: item.timecode } }));
                }}
                className="text-[11px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                跳转到 {Math.floor(item.timecode / 60).toString().padStart(2, "0")}:
                {Math.floor(item.timecode % 60).toString().padStart(2, "0")}
              </button>
            )}
          </div>
        )}
        <div className="text-[13px] text-slate-500 dark:text-slate-400 border-l-2 pl-3 mb-4 leading-relaxed" style={{ borderLeftColor: hexColor }}>
          {item.quote}
        </div>
        {annotation ? (
          <p className="text-[14px] text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
            {annotation.content}
          </p>
        ) : (
          <p className="text-[13px] text-slate-300 italic">暂无笔记</p>
        )}
      </div>
    </motion.div>
  );
}
