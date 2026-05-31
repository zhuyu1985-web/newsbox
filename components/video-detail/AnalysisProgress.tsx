"use client";
import { useState, useRef, useEffect, type JSX } from "react";
import { Check, Loader2, Clock, AlertCircle, RotateCw, Sparkles } from "lucide-react";
import { useAnalysisProgress } from "./hooks/useAnalysisProgress";

const STATUS_ICONS: Record<string, JSX.Element> = {
  done: <Check size={12} className="text-emerald-500" />,
  skipped: <Check size={12} className="text-muted-foreground/60" />,
  in_progress: <Loader2 size={12} className="text-blue-500 animate-spin" />,
  pending: <Clock size={12} className="text-muted-foreground/60" />,
  failed: <AlertCircle size={12} className="text-rose-500" />,
};

export function AnalysisProgress({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { steps, overallPercent, isComplete, refetch } = useAnalysisProgress(jobId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const retry = async (step: string) => {
    await fetch(`/api/ai/video/${jobId}/retry?step=${step}`, { method: "POST" });
    refetch();
  };

  const chipClass = isComplete
    ? "px-2 h-8 rounded-md flex items-center gap-1.5 text-xs bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40"
    : "px-2 h-8 rounded-md flex items-center gap-1.5 text-xs bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-blue-900/40";

  return (
    <div ref={wrapperRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} className={chipClass}>
        <Sparkles size={12} />
        <span>{isComplete ? "分析已完成" : `分析中 ${overallPercent}%`}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-64 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl p-3 z-50">
          <div className="text-xs font-medium mb-2 text-foreground">分析进度</div>
          <div className="space-y-1">
            {steps.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <div className="flex items-center gap-2 text-foreground">
                  {STATUS_ICONS[s.status] ?? STATUS_ICONS.pending}
                  <span>{s.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[10px]">
                    {s.status === "done" && "已完成"}
                    {s.status === "skipped" && "已跳过"}
                    {s.status === "in_progress" && "进行中"}
                    {s.status === "pending" && "等待中"}
                    {s.status === "failed" && "失败"}
                  </span>
                  {s.status === "failed" && (
                    <button
                      onClick={() => retry(s.key)}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      <RotateCw size={10} />
                      重试
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
