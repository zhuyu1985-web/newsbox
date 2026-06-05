"use client";
import { useState, useRef, useEffect, type JSX } from "react";
import { Check, Loader2, Clock, AlertCircle, RotateCw, Sparkles } from "lucide-react";
import { useAnalysisProgress, type JobStatusResponse, type StepKey } from "./hooks/useAnalysisProgress";

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
  const refreshDispatchedRef = useRef(false);
  const { steps, overallPercent, isComplete, hasFailures, refetch, data } = useAnalysisProgress(jobId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!data) return;

    if (!isComplete) {
      refreshDispatchedRef.current = false;
      return;
    }

    if (refreshDispatchedRef.current) return;
    refreshDispatchedRef.current = true;
    const refreshTimer = window.setTimeout(() => {
      window.dispatchEvent(new Event("reader:refresh-content"));
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [data, isComplete]);

  const retry = async (step: StepKey) => {
    // optimistic：立即把目标步骤推进到 in_progress，弹出 pulse 动画，不等服务端响应
    if (data) {
      const next: JobStatusResponse = {
        ...data,
        steps: { ...data.steps, [step]: 'in_progress' },
        errors: { ...(data.errors ?? {}), [step]: null },
      };
      refetch(next, { revalidate: false });
    }
    try {
      await fetch(`/api/ai/video/${jobId}/retry?step=${step}`, { method: "POST" });
    } finally {
      refetch();
    }
  };

  // 终态有失败 → 玫红；全部 done → 绿；进行中 → 蓝色（带 pulse 强调）
  const chipClass = !isComplete
    ? "relative isolate overflow-hidden px-2.5 h-8 rounded-lg flex items-center gap-1.5 text-xs bg-blue-50/90 dark:bg-blue-950/50 text-blue-700 dark:text-blue-200 hover:bg-blue-100/90 dark:hover:bg-blue-900/50 ring-1 ring-blue-200/70 dark:ring-blue-700/70 shadow-[0_0_18px_rgba(37,99,235,0.18)] animate-analysis-glow"
    : hasFailures
    ? "px-2 h-8 rounded-md flex items-center gap-1.5 text-xs bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100/80 dark:hover:bg-rose-900/40"
    : "px-2 h-8 rounded-md flex items-center gap-1.5 text-xs bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40";

  const chipLabel = !isComplete
    ? `分析中 ${overallPercent}%`
    : hasFailures
    ? "分析未完成"
    : "AI 分析完成";

  return (
    <div ref={wrapperRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} className={chipClass}>
        {!isComplete && (
          <>
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_15%,rgba(255,255,255,0.75)_45%,transparent_70%)] dark:bg-[linear-gradient(110deg,transparent_15%,rgba(147,197,253,0.28)_45%,transparent_70%)] animate-analysis-shimmer" />
            <span className="pointer-events-none absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-blue-200/60 dark:bg-blue-900/70 overflow-hidden">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(overallPercent, 8)}%` }}
              />
            </span>
          </>
        )}
        <Sparkles size={12} className={!isComplete ? "relative z-10 animate-sparkle" : undefined} />
        <span className="relative z-10">{chipLabel}</span>
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
                  {s.status === "in_progress" && (
                    <span className="text-blue-500/70 text-[10px] animate-pulse">●</span>
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
