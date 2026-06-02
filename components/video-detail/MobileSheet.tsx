"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * MobileSheet
 * - 通用底部抽屉：用于在 < lg 视口承载 速览/原文/笔记/更多 等面板
 * - 点击背景或 Esc 关闭；打开时锁滚动
 * - 仅在 < lg 显示（外层 lg:hidden）
 */
export function MobileSheet({
  open,
  onClose,
  title,
  children,
  height = "75vh",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  height?: string;
}) {
  // 打开时锁定 body 滚动
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-blue-100/40 dark:bg-blue-950/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      {/* 抽屉本体 */}
      <div
        className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-card/95 dark:bg-card/90 backdrop-blur-xl border-t border-x border-border/60 shadow-2xl flex flex-col animate-in slide-in-from-bottom"
        style={{ height }}
      >
        {/* 顶部拖拽指示（仅视觉） */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {/* 标题栏 */}
        <div className="px-4 pb-2 flex items-center justify-between border-b border-border/40 shrink-0">
          <div className="text-base font-semibold text-foreground">{title}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center text-muted-foreground"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        {/* 内容区 — 子面板会自行处理 overflow */}
        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>
  );
}
