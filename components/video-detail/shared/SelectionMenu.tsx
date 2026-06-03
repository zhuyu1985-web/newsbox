"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Pin, HelpCircle, CheckSquare, ChevronRight } from "lucide-react";
import { useExcerpt } from "../hooks/useExcerpt";
import { useMarkers, type MarkerKind } from "../hooks/useMarkers";

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  time: number;
  speaker: string | null;
  segmentIdx: number;
  /** 该 segment 的完整文本（用于计算 selection_start/end） */
  segmentFullText: string;
}

interface Props {
  noteId: string;
}

const MARKER_OPTIONS: Array<{
  kind: MarkerKind;
  label: string;
  Icon: typeof Pin;
  cls: string;
}> = [
  {
    kind: "important",
    label: "标记为重点",
    Icon: Pin,
    cls: "text-sky-300 hover:bg-sky-950/40",
  },
  {
    kind: "question",
    label: "标记为问题",
    Icon: HelpCircle,
    cls: "text-rose-300 hover:bg-rose-950/40",
  },
  {
    kind: "todo",
    label: "标记为待办",
    Icon: CheckSquare,
    cls: "text-amber-300 hover:bg-amber-950/40",
  },
];

export function SelectionMenu({ noteId }: Props) {
  const excerpt = useExcerpt();
  const { createMarker } = useMarkers(noteId);
  const [state, setState] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
    time: 0,
    speaker: null,
    segmentIdx: -1,
    segmentFullText: "",
  });
  const [markerOpen, setMarkerOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || text.length < 2) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      const anchor = sel?.anchorNode;
      const parent =
        anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      // 仅在 transcript 段内出现
      const segEl = parent?.closest(
        '[data-marker-target="transcript"][data-segment-idx]',
      ) as HTMLElement | null;
      if (!segEl) {
        setState((s) => ({ ...s, visible: false }));
        return;
      }
      const time = Number(segEl.getAttribute("data-time")) || 0;
      const speaker = segEl.getAttribute("data-speaker") || null;
      const segmentIdx = Number(segEl.getAttribute("data-segment-idx")) || 0;
      const fullTextEl = segEl.querySelector("[data-segment-text]") as HTMLElement | null;
      const segmentFullText = fullTextEl?.textContent ?? segEl.textContent ?? "";
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setState({
        visible: true,
        x: rect.left,
        y: Math.max(8, rect.top - 50),
        text,
        time,
        speaker,
        segmentIdx,
        segmentFullText,
      });
      setMarkerOpen(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-selection-menu]")) return;
      setState((s) => ({ ...s, visible: false }));
      setMarkerOpen(false);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  if (!state.visible) return null;

  const handleMarker = (kind: MarkerKind) => {
    const start = state.segmentFullText.indexOf(state.text);
    if (start < 0) {
      // 选区跨越多个段落或文本不匹配 — 退化为整句标记
      createMarker({
        marker_kind: kind,
        target_type: "transcript",
        segment_idx: state.segmentIdx,
        anchor_time: state.time,
      });
    } else {
      createMarker({
        marker_kind: kind,
        target_type: "transcript",
        segment_idx: state.segmentIdx,
        anchor_time: state.time,
        selection_start: start,
        selection_end: start + state.text.length,
        selection_text: state.text,
      });
    }
    window.getSelection()?.removeAllRanges();
    setState((s) => ({ ...s, visible: false }));
    setMarkerOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      data-selection-menu
      className="fixed z-50 bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-2xl py-1.5 flex items-center text-xs ring-1 ring-slate-700"
      style={{ top: state.y, left: state.x }}
    >
      <button
        className="px-3 py-1.5 hover:bg-slate-700 flex items-center gap-1.5 rounded-l-lg"
        onClick={() => {
          excerpt({
            excerpt: state.text,
            videoTime: state.time,
            speakerLabel: state.speaker ? `发言人 ${state.speaker}` : null,
          });
          window.getSelection()?.removeAllRanges();
          setState((s) => ({ ...s, visible: false }));
        }}
      >
        <Download size={12} />
        摘录到笔记
      </button>

      <div className="w-px h-4 bg-slate-700" />

      <div className="relative">
        <button
          className="px-3 py-1.5 hover:bg-slate-700 flex items-center gap-1.5 rounded-r-lg"
          onClick={() => setMarkerOpen((v) => !v)}
        >
          <Pin size={12} />
          标记
          <ChevronRight size={11} className={markerOpen ? "rotate-90 transition" : "transition"} />
        </button>
        {markerOpen && (
          <div className="absolute top-full mt-1 right-0 bg-slate-900 dark:bg-slate-800 ring-1 ring-slate-700 rounded-lg shadow-2xl py-1 min-w-[140px]">
            {MARKER_OPTIONS.map((opt) => (
              <button
                key={opt.kind}
                onClick={() => handleMarker(opt.kind)}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 ${opt.cls}`}
              >
                <opt.Icon size={12} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
