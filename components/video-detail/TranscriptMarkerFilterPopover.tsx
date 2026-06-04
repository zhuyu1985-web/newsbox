"use client";

import { Check, CheckSquare, HelpCircle, Pin } from "lucide-react";
import { useVideoDetailStore, type TranscriptMarkerFilterKind } from "./store";

export const TRANSCRIPT_MARKER_FILTERS = [
  {
    kind: "important",
    label: "重点",
    Icon: Pin,
    activeClass:
      "bg-sky-100 text-sky-700 ring-sky-300/80 shadow-sm shadow-sky-200/60 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-700/70",
    idleClass:
      "bg-sky-50/40 text-sky-600/70 ring-sky-200/60 hover:bg-sky-100 hover:text-sky-700 dark:bg-sky-950/20 dark:text-sky-300/70 dark:ring-sky-800/40",
  },
  {
    kind: "question",
    label: "问题",
    Icon: HelpCircle,
    activeClass:
      "bg-rose-100 text-rose-700 ring-rose-300/80 shadow-sm shadow-rose-200/60 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-700/70",
    idleClass:
      "bg-rose-50/40 text-rose-600/70 ring-rose-200/60 hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-950/20 dark:text-rose-300/70 dark:ring-rose-800/40",
  },
  {
    kind: "todo",
    label: "待办",
    Icon: CheckSquare,
    activeClass:
      "bg-amber-100 text-amber-700 ring-amber-300/80 shadow-sm shadow-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-700/70",
    idleClass:
      "bg-amber-50/40 text-amber-600/70 ring-amber-200/60 hover:bg-amber-100 hover:text-amber-700 dark:bg-amber-950/20 dark:text-amber-300/70 dark:ring-amber-800/40",
  },
] as const satisfies ReadonlyArray<{
  kind: TranscriptMarkerFilterKind;
  label: string;
  Icon: typeof Pin;
  activeClass: string;
  idleClass: string;
}>;

export function TranscriptMarkerFilterPopover({
  className = "",
}: {
  className?: string;
}) {
  const showMarkedTranscriptOnly = useVideoDetailStore((s) => s.showMarkedTranscriptOnly);
  const setShowMarkedTranscriptOnly = useVideoDetailStore((s) => s.setShowMarkedTranscriptOnly);
  const selectedTranscriptMarkerKinds = useVideoDetailStore((s) => s.selectedTranscriptMarkerKinds);
  const toggleTranscriptMarkerKind = useVideoDetailStore((s) => s.toggleTranscriptMarkerKind);

  return (
    <div
      className={`w-64 rounded-xl border border-border/60 bg-popover/95 p-4 shadow-xl backdrop-blur-xl ${className}`}
    >
      <div className="mb-3 text-sm font-semibold text-foreground">筛选</div>
      <button
        type="button"
        onClick={() => setShowMarkedTranscriptOnly(!showMarkedTranscriptOnly)}
        className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-sm text-foreground hover:bg-muted/50"
      >
        <span
          className={
            showMarkedTranscriptOnly
              ? "flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-white"
              : "h-4 w-4 rounded border border-muted-foreground/40 bg-background"
          }
        >
          {showMarkedTranscriptOnly && <Check size={12} />}
        </span>
        <span>只看标记内容</span>
      </button>
      <div className="mt-2 flex items-center gap-2 border-b border-border/50 pb-3 pl-8">
        {TRANSCRIPT_MARKER_FILTERS.map((item) => {
          const Icon = item.Icon;
          const active = selectedTranscriptMarkerKinds.includes(item.kind);
          return (
            <button
              key={item.kind}
              type="button"
              onClick={() => toggleTranscriptMarkerKind(item.kind)}
              title={item.label}
              aria-label={`筛选${item.label}标记`}
              aria-pressed={selectedTranscriptMarkerKinds.includes(item.kind)}
              className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 transition-all ${
                active ? item.activeClass : item.idleClass
              }`}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
