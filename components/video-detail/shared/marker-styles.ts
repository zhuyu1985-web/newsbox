import type { MarkerKind } from "../hooks/useMarkers";

export const MARKER_LABEL: Record<MarkerKind, string> = {
  important: "重点",
  question: "问题",
  todo: "待办",
};

export const MARKER_ICON: Record<MarkerKind, string> = {
  important: "📌",
  question: "❓",
  todo: "✅",
};

/** 段落整体背景着色（淡） */
export const MARKER_ROW_BG: Record<MarkerKind, string> = {
  important: "bg-sky-50/70 dark:bg-sky-950/30",
  question: "bg-rose-50/70 dark:bg-rose-950/30",
  todo: "bg-amber-50/70 dark:bg-amber-950/30",
};

/** 段落边框 */
export const MARKER_ROW_RING: Record<MarkerKind, string> = {
  important: "ring-1 ring-sky-300/60 dark:ring-sky-700/60",
  question: "ring-1 ring-rose-300/60 dark:ring-rose-700/60",
  todo: "ring-1 ring-amber-300/60 dark:ring-amber-700/60",
};

/** 选段 highlight 颜色（用作 underline / 下背景） */
export const MARKER_INLINE_BG: Record<MarkerKind, string> = {
  important:
    "bg-sky-200/60 dark:bg-sky-800/40 underline decoration-sky-400 decoration-1 underline-offset-2",
  question:
    "bg-rose-200/60 dark:bg-rose-800/40 underline decoration-rose-400 decoration-1 underline-offset-2",
  todo:
    "bg-amber-200/60 dark:bg-amber-800/40 underline decoration-amber-400 decoration-1 underline-offset-2",
};

/** 角标圆点 */
export const MARKER_DOT_BG: Record<MarkerKind, string> = {
  important: "bg-sky-500",
  question: "bg-rose-500",
  todo: "bg-amber-500",
};

/** 按钮高亮（pressed） */
export const MARKER_BTN_ACTIVE: Record<MarkerKind, string> = {
  important: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300",
  question: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  todo: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
};
