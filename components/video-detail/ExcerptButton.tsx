"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Highlighter, MousePointer } from "lucide-react";
import { toast } from "sonner";
import { useExcerpt } from "./hooks/useExcerpt";
import { ExcerptDialog } from "./ExcerptDialog";
import type { AudioAnalysisResult } from "@/lib/ai-analysis/types";

interface Props {
  noteId: string;
  audio: AudioAnalysisResult | null | undefined;
}

/**
 * ExcerptButton
 * - 顶栏「摘取」按钮 + 小弹窗
 * - 两个动作：摘取选中内容（依赖当前选区） / 摘取标记内容（打开 dialog）
 */
export function ExcerptButton({ noteId, audio }: Props) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const excerpt = useExcerpt();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const excerptSelected = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text) {
      toast.error("请先在原文中选中要摘取的内容");
      return;
    }
    // 试着定位 segment
    const anchor = sel?.anchorNode;
    const parent = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
    const segEl = parent?.closest("[data-time]") as HTMLElement | null;
    const time = segEl ? Number(segEl.getAttribute("data-time")) || 0 : 0;
    const speaker = segEl?.getAttribute("data-speaker") || null;
    excerpt({
      excerpt: text,
      videoTime: time,
      speakerLabel: speaker ? `发言人 ${speaker}` : null,
    });
    sel?.removeAllRanges();
    setOpen(false);
  };

  const openMarkerDialog = () => {
    setOpen(false);
    setDialogOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          open
            ? "w-8 h-8 rounded bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center"
            : "w-8 h-8 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center"
        }
        title="摘取到笔记"
      >
        <Copy size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-52 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl py-1.5 z-50">
          <button
            onClick={excerptSelected}
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 flex items-center gap-2 text-foreground"
          >
            <MousePointer size={13} className="text-muted-foreground" />
            <span>摘取选中内容</span>
          </button>
          <button
            onClick={openMarkerDialog}
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 flex items-center gap-2 text-foreground"
          >
            <Highlighter size={13} className="text-muted-foreground" />
            <span>摘取标记内容</span>
          </button>
        </div>
      )}
      <ExcerptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        noteId={noteId}
        audio={audio}
      />
    </div>
  );
}
