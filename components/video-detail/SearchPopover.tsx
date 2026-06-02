"use client";
import { useEffect, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { useVideoDetailStore } from "./store";
import type { TranscriptSegment } from "@/lib/ai-analysis/types";

interface Props {
  transcript: TranscriptSegment[];
  keywords: string[] | undefined;
}

export function SearchPopover({ transcript, keywords }: Props) {
  const searchOpen = useVideoDetailStore((s) => s.searchOpen);
  const searchQuery = useVideoDetailStore((s) => s.searchQuery);
  const searchMatches = useVideoDetailStore((s) => s.searchMatches);
  const searchCurrentMatch = useVideoDetailStore((s) => s.searchCurrentMatch);
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);
  const setSearchOpen = useVideoDetailStore((s) => s.setSearchOpen);
  const setSearchQuery = useVideoDetailStore((s) => s.setSearchQuery);
  const setSearchMatches = useVideoDetailStore((s) => s.setSearchMatches);
  const nextMatch = useVideoDetailStore((s) => s.nextMatch);
  const prevMatch = useVideoDetailStore((s) => s.prevMatch);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 打开时聚焦输入框
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // 外部点击 + Esc 关闭
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, setSearchOpen]);

  // 跟随 query 变化重新计算匹配
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const indices: number[] = [];
    transcript.forEach((seg, i) => {
      if (seg.text.toLowerCase().includes(q)) indices.push(i);
    });
    setSearchMatches(indices);
    if (indices.length > 0) setActiveTab("transcript");
  }, [searchQuery, transcript, setSearchMatches, setActiveTab]);

  if (!searchOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-12 w-96 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl z-50 p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Search size={14} className="text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (e.shiftKey) prevMatch();
              else nextMatch();
            }
          }}
          placeholder="搜索原文…回车下一个，Shift+回车上一个"
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="w-5 h-5 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center text-muted-foreground"
            title="清除"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {searchQuery && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2 mb-2">
          <span>
            {searchMatches.length > 0
              ? `${searchCurrentMatch + 1} / ${searchMatches.length}`
              : "无匹配"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMatch}
              disabled={searchMatches.length === 0}
              className="w-6 h-6 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
              title="上一个 (Shift+回车)"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={nextMatch}
              disabled={searchMatches.length === 0}
              className="w-6 h-6 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
              title="下一个 (回车)"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      )}

      {!searchQuery && keywords && keywords.length > 0 && (
        <div className="pt-1">
          <div className="text-[11px] text-muted-foreground mb-1.5">猜你想搜</div>
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 12).map((kw) => (
              <button
                key={kw}
                onClick={() => setSearchQuery(kw)}
                className="px-2 py-1 rounded text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-900/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/40"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
