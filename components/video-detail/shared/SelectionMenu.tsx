"use client";
import { useEffect, useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { useExcerpt } from "../hooks/useExcerpt";
import { useAnnotate } from "../hooks/useAnnotate";

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  time: number;
  speaker: string | null;
}

interface Props {
  noteId: string;
}

export function SelectionMenu({ noteId }: Props) {
  const excerpt = useExcerpt();
  const annotate = useAnnotate();
  const [state, setState] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
    time: 0,
    speaker: null,
  });

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || text.length < 4) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      // Only respond to selections inside transcript segments
      const anchor = sel?.anchorNode;
      const parent =
        anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      const segEl = parent?.closest("[data-time]") as HTMLElement | null;
      if (!segEl) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      // Make sure the selection is in TranscriptPanel context (data-speaker attr present)
      const speakerAttr = segEl.getAttribute("data-speaker");
      if (speakerAttr === null) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      const time = Number(segEl.getAttribute("data-time")) || 0;
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setState({
        visible: true,
        x: rect.left,
        y: Math.max(8, rect.top - 50),
        text,
        time,
        speaker: speakerAttr || null,
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-selection-menu]")) return;
      setState((s) => ({ ...s, visible: false }));
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  if (!state.visible) return null;

  return (
    <div
      data-selection-menu
      className="fixed z-50 bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-2xl py-1.5 flex items-center text-xs ring-1 ring-slate-700"
      style={{ top: state.y, left: state.x }}
    >
      <button
        className="px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-slate-700 flex items-center gap-1.5 rounded-l-lg"
        onClick={() => {
          excerpt({
            excerpt: state.text,
            videoTime: state.time,
            speakerLabel: state.speaker
              ? `发言人 ${state.speaker}`
              : null,
          });
          window.getSelection()?.removeAllRanges();
          setState((s) => ({ ...s, visible: false }));
        }}
      >
        <Download size={12} />
        摘录到笔记
      </button>

      <div className="w-px h-4 bg-slate-700" />

      <button
        className="px-3 py-1.5 hover:bg-slate-700 dark:hover:bg-slate-700 flex items-center gap-1.5 rounded-r-lg"
        onClick={async () => {
          const ok = await annotate({
            noteId,
            text: state.text,
            videoTime: state.time,
          });
          if (ok) {
            window.getSelection()?.removeAllRanges();
            setState((s) => ({ ...s, visible: false }));
          }
        }}
      >
        <Sparkles size={12} />
        标记
      </button>
    </div>
  );
}
