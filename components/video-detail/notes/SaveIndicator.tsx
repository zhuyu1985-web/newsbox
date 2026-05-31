"use client";
import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "failed";

export function SaveIndicator({
  state,
  charCount,
  onRetry,
}: {
  state: SaveState;
  charCount: number;
  onRetry?: () => void;
}) {
  return (
    <div className="border-t border-border/50 px-4 py-1.5 text-[11px] flex items-center justify-between bg-card/40 backdrop-blur-xl shrink-0">
      <span
        className={
          state === "failed"
            ? "text-rose-500 dark:text-rose-400 cursor-pointer flex items-center gap-1 hover:underline"
            : "text-muted-foreground flex items-center gap-1"
        }
        onClick={state === "failed" ? onRetry : undefined}
      >
        {state === "idle" && <span>未保存</span>}
        {state === "saving" && (
          <>
            <Loader2 size={11} className="animate-spin" />
            保存中
          </>
        )}
        {state === "saved" && (
          <>
            <Check size={11} />
            已保存
          </>
        )}
        {state === "failed" && (
          <>
            <AlertCircle size={11} />
            保存失败 · 点击重试
          </>
        )}
      </span>
      <span className="text-muted-foreground">{charCount} 字</span>
    </div>
  );
}
