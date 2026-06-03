"use client";
import { Pin, HelpCircle, CheckSquare, X } from "lucide-react";
import {
  MARKER_BTN_ACTIVE,
  MARKER_LABEL,
} from "./marker-styles";
import type {
  MarkerKind,
  MarkerTarget,
  Marker,
} from "../hooks/useMarkers";

interface Props {
  /** 当前段上已经存在的标记类型（用于按钮高亮 + 显示「取消标记」） */
  activeKinds: Set<MarkerKind>;
  /** 用户点击 4 个动作之一 */
  onToggle: (kind: MarkerKind) => void;
  /** 用户点击「取消标记」（清除该段所有整段标记） */
  onClear: () => void;
  /** 浮窗位置：right=右上角，left=左上角 */
  align?: "right" | "left";
  /** 悬浮显示而不是常驻；默认 hover 显示 */
  hoverOnly?: boolean;
}

const ICONS: Record<MarkerKind, typeof Pin> = {
  important: Pin,
  question: HelpCircle,
  todo: CheckSquare,
};

const KINDS: MarkerKind[] = ["important", "question", "todo"];

/**
 * MarkerActionBar
 * - 4 个按钮：重点 / 问题 / 待办 / 取消
 * - 默认 group-hover 显示；激活的 kind 高亮（带色）
 * - 「取消」只在该段已有任意 marker 时显示
 */
export function MarkerActionBar({
  activeKinds,
  onToggle,
  onClear,
  align = "right",
  hoverOnly = true,
}: Props) {
  const visibility = hoverOnly
    ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
    : "";
  const position = align === "right" ? "right-0" : "left-0";
  const hasAny = activeKinds.size > 0;

  return (
    <div
      className={`absolute top-0 ${position} flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-popover/95 backdrop-blur-md border border-border/60 shadow-sm ${visibility} transition-opacity z-10`}
      onClick={(e) => e.stopPropagation()}
    >
      {KINDS.map((kind) => {
        const Icon = ICONS[kind];
        const active = activeKinds.has(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(kind);
            }}
            title={MARKER_LABEL[kind]}
            className={
              active
                ? `w-7 h-7 rounded flex items-center justify-center ${MARKER_BTN_ACTIVE[kind]}`
                : "w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/60"
            }
            aria-pressed={active}
          >
            <Icon size={13} />
          </button>
        );
      })}
      {hasAny && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          title="取消标记"
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * 工具：从 markers 列表中筛出某锚点上的「整段标记」kind 集合
 */
export function getActiveKinds(
  markers: Marker[],
  target_type: MarkerTarget,
  segment_idx: number | null,
  speaker_id?: string | null,
): Set<MarkerKind> {
  const out = new Set<MarkerKind>();
  for (const m of markers) {
    if (m.target_type !== target_type) continue;
    if ((m.segment_idx ?? null) !== segment_idx) continue;
    if ((m.speaker_id ?? null) !== (speaker_id ?? null)) continue;
    if (m.selection_start != null) continue; // 只看整段标记
    out.add(m.marker_kind);
  }
  return out;
}
