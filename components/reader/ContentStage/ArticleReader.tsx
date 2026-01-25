"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, User, Building2, Download as DownloadIcon, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SelectionMenu } from "../SelectionMenu";
import { ImageLightbox } from "../ImageLightbox";
import { TagManager } from "../TagManager";
import { AnnotationDialog } from "../AnnotationDialog";
import { NEWS_STYLING_CLASSES } from "@/lib/services/html-sanitizer";
import { useReaderPreferences } from "@/components/reader/ReaderPreferencesProvider";

interface Note {
  id: string;
  title: string | null;
  author: string | null;
  site_name: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  content_html: string | null;
  content_text: string | null;
  source_url: string | null;
  created_at: string;
  published_at: string | null;
  estimated_read_time?: number;
}

interface Highlight {
  id: string;
  quote: string;
  range_data: any;
  range_start?: number | null;
  range_end?: number | null;
  color: string;
  source_url: string | null;
  created_at: string;
}

// 颜色映射
const COLOR_MAP: Record<string, string> = {
  yellow: '#fef08a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
};

export function ArticleReader({ note }: { note: Note }) {
  const { prefs, lineHeightValue, fontStack } = useReaderPreferences();

  // Reader theme colors (independent of global theme)
  const articleBgClass =
    prefs.theme === "sepia"
      ? "bg-[#f8f2e3]"
      : prefs.theme === "dark"
        ? "bg-slate-950"
        : "bg-white";
  const articleTextClass =
    prefs.theme === "sepia"
      ? "text-[#3b2f2f]"
      : prefs.theme === "dark"
        ? "text-slate-200"
        : "text-slate-900";
  // 新策略：把高亮注入 HTML 让 React 渲染
  const USE_HIGHLIGHT_HTML_INJECTION = true;
  const ENABLE_DOM_HIGHLIGHT_PATCHING = false;

  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [selectedTextForAnnotation, setSelectedTextForAnnotation] = useState("");
  const [currentHighlightIdForAnnotation, setCurrentHighlightIdForAnnotation] = useState<string | undefined>();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<
    { src: string; alt: string; caption?: string }[]
  >([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const buildHighlightedHtml = useCallback(
    (baseHtml: string, hs: Highlight[]) => {
      if (!baseHtml) return "";
      if (!hs.length) return baseHtml;

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(baseHtml, "text/html");
        const root = doc.body as unknown as HTMLElement;

        const rangeFromGlobalOffsetsInDoc = (rootEl: HTMLElement, start: number, end: number) => {
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
          const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
          let cur: Text | null = walker.nextNode() as Text | null;
          let idx = 0;
          let startNode: Text | null = null;
          let endNode: Text | null = null;
          let startOffset = 0;
          let endOffset = 0;
          while (cur) {
            const len = cur.nodeValue?.length ?? 0;
            const nextIdx = idx + len;
            if (!startNode && start >= idx && start <= nextIdx) {
              startNode = cur;
              startOffset = Math.max(0, Math.min(len, start - idx));
            }
            if (!endNode && end >= idx && end <= nextIdx) {
              endNode = cur;
              endOffset = Math.max(0, Math.min(len, end - idx));
            }
            if (startNode && endNode) break;
            idx = nextIdx;
            cur = walker.nextNode() as Text | null;
          }
          if (!startNode || !endNode) return null;
          const r = doc.createRange();
          r.setStart(startNode, startOffset);
          r.setEnd(endNode, endOffset);
          return r;
        };

        const fullText = root.textContent || "";
        const items = hs
          .map((h) => {
            let start =
              typeof h.range_start === "number" ? h.range_start : h.range_data?.globalStart;
            let end = typeof h.range_end === "number" ? h.range_end : h.range_data?.globalEnd;

            // 关键兜底：如果历史数据里 start/end 为空（常见于“从段落开头划词”时计算失败），
            // 用 quote 在全文中做一次定位，至少保证能渲染出来。
            if (!Number.isFinite(start) || !Number.isFinite(end) || (end as number) <= (start as number)) {
              const q = (h.quote || "").trim();
              if (q) {
                const idx = fullText.indexOf(q);
                if (idx >= 0) {
                  start = idx;
                  end = idx + q.length;
                }
              }
            }

            return { h, start, end };
          })
          .filter((x) => typeof x.start === "number" && typeof x.end === "number" && x.end > x.start)
          .sort((a, b) => (a.start as number) - (b.start as number));

        for (const { h, start, end } of items) {
          const startN = start as number;
          const endN = end as number;
          if (!Number.isFinite(startN) || !Number.isFinite(endN) || endN <= startN) continue;

          const cssColor = COLOR_MAP[h.color] || h.color;

          // 关键重构：不再依赖 Range 的跨块级处理（容易踩坑），
          // 而是用“全局偏移 -> 文本节点片段”方式分段包裹。
          const segments: { node: Text; startOffset: number; endOffset: number }[] = [];

          const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
          let node: Node | null;
          let acc = 0;
          while ((node = walker.nextNode())) {
            const t = node as Text;
            const len = t.nodeValue?.length ?? 0;
            const nodeStart = acc;
            const nodeEnd = acc + len;

            if (len > 0) {
              const overlapStart = Math.max(startN, nodeStart);
              const overlapEnd = Math.min(endN, nodeEnd);
              if (overlapStart < overlapEnd) {
                segments.push({
                  node: t,
                  startOffset: overlapStart - nodeStart,
                  endOffset: overlapEnd - nodeStart,
                });
              }
            }

            acc = nodeEnd;
            if (acc >= endN) break;
          }

          if (!segments.length) continue;

          // 从后往前包裹，避免在同一文档中修改节点导致 offset 失效
          for (let segIndex = segments.length - 1; segIndex >= 0; segIndex--) {
            const seg = segments[segIndex];
            const r = doc.createRange();
            r.setStart(seg.node, Math.max(0, Math.min(seg.startOffset, seg.node.nodeValue?.length ?? 0)));
            r.setEnd(seg.node, Math.max(0, Math.min(seg.endOffset, seg.node.nodeValue?.length ?? 0)));
            if (r.collapsed) continue;

            const mark = doc.createElement("mark");
            // 保证永远存在一个稳定锚点用于 scroll：highlight-<id>
            mark.id = segIndex === 0 ? `highlight-${h.id}` : `highlight-${h.id}-${segIndex}`;
            mark.setAttribute("data-highlight-id", h.id);
            mark.style.setProperty("background-color", cssColor, "important");
            mark.style.padding = "0 2px";
            mark.style.borderRadius = "2px";
            mark.style.cursor = "pointer";
            mark.style.display = "inline";

            try {
              r.surroundContents(mark);
            } catch {
              try {
                const frag = r.extractContents();
                mark.appendChild(frag);
                r.insertNode(mark);
              } catch (fallbackError) {
                console.warn("Failed to highlight:", h.id, fallbackError);
              }
            }
          }
        }

        return root.innerHTML;
      } catch {
        return baseHtml;
      }
    },
    [note.id]
  );

  function processContentHtml(html: string | null) {
    if (!html) return null;
    return html.replace(/<img/g, '<img referrerpolicy="no-referrer"');
  }

  const processedHtml = useMemo(() => processContentHtml(note.content_html || "") || "", [note.content_html]);
  const htmlForRender = useMemo(
    () => buildHighlightedHtml(processedHtml, highlights),
    [processedHtml, highlights, buildHighlightedHtml]
  );

  const getNormalizedTextEndpoints = useCallback((range: Range) => {
    const toTextStart = (): { node: Text; offset: number } | null => {
      const sc = range.startContainer;
      const so = range.startOffset;
      if (sc.nodeType === Node.TEXT_NODE) return { node: sc as Text, offset: so };
      if (sc.nodeType === Node.ELEMENT_NODE) {
        const el = sc as Element;
        const direct = el.childNodes[so];
        // 关键修复：TreeWalker.nextNode() 不会返回 root 自身。
        // 当 direct 恰好是 Text（例如从段落开头选中时常见），以前会拿不到 first，导致 globalStart 变成 null。
        if (direct && direct.nodeType === Node.TEXT_NODE) {
          return { node: direct as Text, offset: 0 };
        }
        const walker = document.createTreeWalker(
          direct ?? el,
          NodeFilter.SHOW_TEXT,
          null
        );
        const first = walker.nextNode() as Text | null;
        if (first) return { node: first, offset: 0 };
      }
      return null;
    };

    const toTextEnd = (): { node: Text; offset: number } | null => {
      const ec = range.endContainer;
      const eo = range.endOffset;
      if (ec.nodeType === Node.TEXT_NODE) return { node: ec as Text, offset: eo };
      if (ec.nodeType === Node.ELEMENT_NODE) {
        const el = ec as Element;
        const direct = el.childNodes[Math.max(0, eo - 1)];
        if (direct && direct.nodeType === Node.TEXT_NODE) {
          return { node: direct as Text, offset: (direct.textContent?.length ?? 0) };
        }
        const walker = document.createTreeWalker(
          direct ?? el,
          NodeFilter.SHOW_TEXT,
          null
        );
        let last: Text | null = null;
        let cur: Node | null;
        while ((cur = walker.nextNode())) last = cur as Text;
        if (last) return { node: last, offset: (last.textContent?.length ?? 0) };
      }
      return null;
    };

    const start = toTextStart();
    const end = toTextEnd();
    if (!start || !end) return null;
    return { start, end };
  }, []);

  const getGlobalOffset = useCallback((root: HTMLElement, target: Text, offset: number) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    let acc = 0;
    while ((node = walker.nextNode())) {
      const t = node as Text;
      const len = t.textContent?.length ?? 0;
      if (t === target) return acc + Math.min(Math.max(offset, 0), len);
      acc += len;
    }
    return null;
  }, []);

  const rangeFromGlobalOffsets = useCallback((root: HTMLElement, start: number, end: number) => {
    if (start < 0 || end < 0 || end <= start) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node: Node | null;
    let acc = 0;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startOffset = 0;
    let endOffset = 0;

    while ((node = walker.nextNode())) {
      const t = node as Text;
      const len = t.textContent?.length ?? 0;
      if (!startNode && acc + len >= start) {
        startNode = t;
        startOffset = Math.max(0, start - acc);
      }
      if (startNode && acc + len >= end) {
        endNode = t;
        endOffset = Math.max(0, end - acc);
        break;
      }
      acc += len;
    }

    if (!startNode || !endNode) return null;
    const r = document.createRange();
    r.setStart(startNode, Math.min(startOffset, startNode.textContent?.length ?? 0));
    r.setEnd(endNode, Math.min(endOffset, endNode.textContent?.length ?? 0));
    return r;
  }, []);

  useEffect(() => {
    const loadHighlightsOnce = async () => {
      try {
        const response = await fetch(`/api/highlights?note_id=${note.id}`);
        if (response.ok) {
          const data = await response.json();
          setHighlights(data.highlights || []);
        }
      } catch (error) {
        console.error("加载高亮失败:", error);
      }
    };
    loadHighlightsOnce();

    // 监听全局刷新高亮事件
    const handleRefresh = () => loadHighlightsOnce();
    window.addEventListener("reader:refresh-highlights", handleRefresh);
    return () => window.removeEventListener("reader:refresh-highlights", handleRefresh);
  }, [note.id]);

  const createHighlightRecord = async (text: string, color: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const tempId = `temp-${Date.now()}`;
    
    try {
      const root = contentRef.current;
      const norm = root ? getNormalizedTextEndpoints(range) : null;
      const globalStart =
        root && norm ? getGlobalOffset(root, norm.start.node, norm.start.offset) : null;
      const globalEnd =
        root && norm ? getGlobalOffset(root, norm.end.node, norm.end.offset) : null;

      // 如果无法计算全局偏移（常见于跨段落/从段落开头选中导致端点解析失败），直接中止创建，
      // 避免写入一条“列表有、正文永远渲染不出来”的坏数据。
      if (!Number.isFinite(globalStart) || !Number.isFinite(globalEnd) || (globalEnd as number) <= (globalStart as number)) {
        console.warn("无法计算高亮范围（globalStart/globalEnd 无效），取消创建高亮");
        return null;
      }

      const tempHighlight: Highlight = {
        id: tempId,
        quote: text,
        range_data: { globalStart, globalEnd },
        range_start: globalStart,
        range_end: globalEnd,
        color,
        source_url: note.source_url ?? null,
        created_at: new Date().toISOString(),
      };
      setHighlights((prev) => [tempHighlight, ...prev]);
      selection.removeAllRanges();

      const rangeData = {
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        quote: text,
        globalStart,
        globalEnd,
      };

      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_id: note.id,
          quote: text,
          range_data: rangeData,
          range_start: globalStart,
          range_end: globalEnd,
          color: color,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setHighlights((prev) => [data.highlight, ...prev.filter((h) => h.id !== tempId)]);
        
        // 通知右侧面板立即更新（传递新创建的高亮数据）
        window.dispatchEvent(new CustomEvent("reader:new-highlight", { 
          detail: { highlight: data.highlight } 
        }));
        // 同时触发完整刷新以确保数据一致性
        window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
        window.dispatchEvent(new CustomEvent("reader:has-annotations", { detail: { count: 1 } }));
        
        return data.highlight;
      } else {
        setHighlights((prev) => prev.filter((h) => h.id !== tempId));
        return null;
      }
    } catch (error) {
      console.error('创建高亮出错:', error);
      setHighlights((prev) => prev.filter((h) => h.id !== tempId));
      return null;
    }
  };

  const handleHighlight = async (text: string, color: string) => {
    await createHighlightRecord(text, color);
  };

  const handleAnnotate = async (text: string, color: string, highlightId?: string) => {
    if (highlightId) {
      // 如果是编辑已有的高亮
      setSelectedTextForAnnotation(text);
      setCurrentHighlightIdForAnnotation(highlightId);
      setShowAnnotationDialog(true);
    } else {
      // 创建新高亮并批注
      const highlight = await createHighlightRecord(text, color);
      if (highlight) {
        setSelectedTextForAnnotation(text);
        setCurrentHighlightIdForAnnotation(highlight.id);
        setShowAnnotationDialog(true);
      } else {
        setSelectedTextForAnnotation(text);
        setCurrentHighlightIdForAnnotation(undefined);
        setShowAnnotationDialog(true);
      }
    }
  };

  const handleUpdateHighlight = async (highlightId: string, color: string) => {
    try {
      // 乐观更新
      setHighlights(prev => prev.map(h => 
        h.id === highlightId ? { ...h, color } : h
      ));

      // 发送请求
      const response = await fetch('/api/highlights', {
        method: 'PUT', // 假设后端支持 PUT 更新
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: highlightId,
          color: color,
        }),
      });

      if (response.ok) {
        // 通知右侧面板刷新
        window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
      } else {
        // 回滚
        console.error("更新高亮失败");
        // 这里可以做回滚逻辑，重新加载数据
        window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
      }
    } catch (error) {
      console.error("更新高亮出错:", error);
    }
  };

  const handleAnnotationSuccess = () => {
    console.log("Annotation saved successfully!");
    window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
  };

  const handleAIExplain = (text: string) => {
    const event = new CustomEvent("reader:switch-tab", { 
      detail: { tab: "ai-analysis", text } 
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && target.closest(".prose")) {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) return;

        e.preventDefault();
        e.stopPropagation();
        
        const allImages = Array.from(
          document.querySelectorAll<HTMLImageElement>(".prose img")
        ).map((img) => ({
          src: img.src,
          alt: img.alt || "",
          caption: img.nextElementSibling?.textContent || undefined,
        }));

        const clickedIndex = allImages.findIndex(
          (img) => img.src === (target as HTMLImageElement).src
        );

        setLightboxImages(allImages);
        setLightboxInitialIndex(clickedIndex >= 0 ? clickedIndex : 0);
        setLightboxOpen(true);
      }
    };

    document.addEventListener("click", handleImageClick, { capture: false });
    return () => document.removeEventListener("click", handleImageClick);
  }, []);

  // 监听高亮区域的点击
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 检查是否点击了 mark 元素
      if (target.tagName === "MARK" && target.id.startsWith("highlight-")) {
        e.preventDefault();
        e.stopPropagation();
        
        const highlightId = target.getAttribute("data-highlight-id");
        if (highlightId) {
          // 查找该高亮的信息
          const highlight = highlights.find(h => h.id === highlightId);
          if (highlight) {
            const rect = target.getBoundingClientRect();
            
            // 触发菜单显示
            window.dispatchEvent(new CustomEvent("reader:interaction-highlight", {
              detail: {
                highlightId,
                rect,
                color: highlight.color,
                text: highlight.quote || target.textContent
              }
            }));
            
            // 触发右侧滚动定位
            window.dispatchEvent(new CustomEvent("reader:scroll-to-highlight", { 
              detail: { highlightId } 
            }));
          }
        }
      }
    };

    const contentEl = contentRef.current;
    if (contentEl) {
      contentEl.addEventListener("click", handleHighlightClick);
    }
    
    return () => {
      if (contentEl) {
        contentEl.removeEventListener("click", handleHighlightClick);
      }
    };
  }, [highlights]);

  return (
    <>
      <SelectionMenu
        noteId={note.id}
        onHighlight={handleHighlight}
        onUpdateHighlight={handleUpdateHighlight}
        onAnnotate={handleAnnotate}
        onAIExplain={handleAIExplain}
      />

      <article
        className={cn(
          "mx-auto px-6 py-12 min-h-screen relative text-left rounded-none",
          articleBgClass,
          articleTextClass,
          prefs.theme === "sepia" && "article-sepia-theme",
          prefs.theme === "dark" && "article-dark-theme",
        )}
        style={{
          maxWidth: prefs.maxWidth,
          // CSS 变量驱动正文排版（见 app/globals.css 中的 .article-content）
          ["--reader-font-size" as any]: `${prefs.fontSize}px`,
          ["--reader-line-height" as any]: String(lineHeightValue),
          ["--reader-font-family" as any]: fontStack,
        }}
      >
        {/* 元信息头 */}
        <header className="mb-12">
          <h1 className={cn(
            "text-[32px] font-bold leading-tight mb-6 tracking-tight",
            prefs.theme === "sepia" ? "text-[#2f2626]" :
            prefs.theme === "dark" ? "text-white" :
            "text-slate-900"
          )}>
            {note.title || "无标题"}
          </h1>

          <div className={cn(
            "flex items-center gap-4 text-[13px]",
            prefs.theme === "sepia" ? "text-[#6b5b4b]" :
            prefs.theme === "dark" ? "text-slate-300" :
            "text-slate-600"
          )}>
            {note.site_name && (
              <span className={cn(
                "flex items-center gap-1.5 font-medium",
                prefs.theme === "sepia" ? "text-[#5b4a3b]" :
                prefs.theme === "dark" ? "text-white" :
                "text-slate-700"
              )}>
                {note.site_name}
              </span>
            )}
            {note.author && (
              <span className="flex items-center gap-1.5">
                {note.author}
              </span>
            )}
          </div>
        </header>

        {/* 正文内容 */}
        {note.content_html ? (
          <div
            ref={contentRef}
            data-article-content="true"
            data-selectable="true"
            className={cn(
              "select-text article-content",
              NEWS_STYLING_CLASSES,
            )}
            dangerouslySetInnerHTML={{
              __html: htmlForRender,
            }}
          />
        ) : (
          <div className={cn(
            "text-center py-24 rounded-2xl border-2 border-dashed",
            prefs.theme === "sepia" ? "bg-[#fbf6ea] border-[#eadfcf]" :
            prefs.theme === "dark" ? "bg-slate-800/50 border-slate-700" :
            "bg-slate-50 border-slate-200",
          )}>
            <Globe className={cn(
              "h-12 w-12 mx-auto mb-4",
              prefs.theme === "sepia" ? "text-[#eadfcf]" :
              prefs.theme === "dark" ? "text-slate-500" :
              "text-slate-300"
            )} />
            <h3 className={cn(
              "text-lg font-medium mb-2",
              prefs.theme === "sepia" ? "text-[#2f2626]" :
              prefs.theme === "dark" ? "text-white" :
              "text-slate-800"
            )}>内容尚未加载</h3>
            <p className={cn(
              "text-sm mb-8 max-w-[280px] mx-auto",
              prefs.theme === "sepia" ? "text-[#6b5b4b]" :
              prefs.theme === "dark" ? "text-slate-300" :
              "text-slate-600"
            )}>
              由于原网页限制或抓取失败，无法直接显示正文内容。
            </p>

            <div className="flex items-center justify-center gap-4">
              {note.source_url && (
                <button
                  onClick={() => window.open(note.source_url!, "_blank")}
                  className="text-sm text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                  访问原网页
                </button>
              )}
            </div>
          </div>
        )}
      </article>

      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxInitialIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <AnnotationDialog
        open={showAnnotationDialog}
        onOpenChange={setShowAnnotationDialog}
        noteId={note.id}
        highlightId={currentHighlightIdForAnnotation}
        selectedText={selectedTextForAnnotation}
        onSuccess={handleAnnotationSuccess}
      />
    </>
  );
}
