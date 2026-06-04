"use client";

import { Sparkles, FileText, MessageCircleQuestion, NotebookPen, MoreHorizontal } from "lucide-react";
import { useVideoDetailStore } from "./store";

const TABS = [
  { key: "brief", label: "速览", Icon: Sparkles },
  { key: "transcript", label: "原文", Icon: FileText },
  { key: "qa", label: "问答", Icon: MessageCircleQuestion },
  { key: "notes", label: "笔记", Icon: NotebookPen },
  { key: "more", label: "更多", Icon: MoreHorizontal },
] as const;

/**
 * MobileTabBar
 * - 仅在 < lg 视口显示
 * - 底部 4 个 tab，分别打开对应的 MobileSheet
 * - 再次点击当前激活的 tab 会关闭抽屉
 */
export function MobileTabBar() {
  const open = useVideoDetailStore((s) => s.mobileSheetOpen);
  const setOpen = useVideoDetailStore((s) => s.setMobileSheetOpen);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-14 lg:hidden bg-background/90 backdrop-blur-xl border-t border-border/50 z-30 flex items-center justify-around">
      {TABS.map((t) => {
        const active = open === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setOpen(active ? null : t.key)}
            className={
              active
                ? "flex flex-col items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 px-3 py-1 rounded"
                : "flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground px-3 py-1 rounded"
            }
          >
            <t.Icon size={18} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
