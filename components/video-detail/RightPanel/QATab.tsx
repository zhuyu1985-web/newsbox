"use client";
import { useVideoSeek } from "../hooks/useVideoSeek";
import type { QAPair } from "@/lib/ai-analysis/types";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export function QATab({ qaPairs }: { qaPairs: QAPair[] | undefined }) {
  const { seek } = useVideoSeek();

  if (!qaPairs?.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        AI 暂未提炼出问答对
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {qaPairs.map((qa, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
              Q
            </span>
            <div className="text-sm text-foreground leading-relaxed flex-1">{qa.q}</div>
            {typeof qa.anchorTime === "number" && (
              <button
                onClick={() => seek(qa.anchorTime!)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono shrink-0"
              >
                {formatTime(qa.anchorTime)}
              </button>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
              A
            </span>
            <div className="text-sm text-muted-foreground leading-relaxed flex-1">{qa.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
