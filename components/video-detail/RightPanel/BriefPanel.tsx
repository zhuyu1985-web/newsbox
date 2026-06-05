"use client";
import { useState } from "react";
import { AlertCircle, RotateCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoDetailStore } from "../store";
import { KeywordsRow } from "./KeywordsRow";
import { SummaryBlock } from "./SummaryBlock";
import { ChaptersTab } from "./ChaptersTab";
import { SpeakerSummaryTab } from "./SpeakerSummaryTab";
import type { VideoJobRow } from "@/components/reader/ReaderPageWrapper";

const SUBTABS = [
  { key: "chapters", label: "章节速览" },
  { key: "speakers", label: "发言总结" },
] as const;

export function BriefPanel({
  noteId,
  videoJob,
}: {
  noteId: string;
  videoJob: VideoJobRow | null;
}) {
  const subTab = useVideoDetailStore((s) => s.activeBriefSubTab);
  const setSubTab = useVideoDetailStore((s) => s.setActiveBriefSubTab);
  // optimistic：用户重试后立即切到 "分析中" 视图，等服务端推进真实状态再覆盖
  const [retrySubmitted, setRetrySubmitted] = useState(false);
  const audio = videoJob?.audio_result;
  // 只有 audio 分析完成才允许 AI 兜底提取（依赖 transcript）
  const canEnrich = videoJob?.audio_status === "done" && (audio?.transcript?.length ?? 0) > 0;
  const jobId = videoJob?.id ?? null;

  // 服务端已推进到非 failed → 撤销 optimistic
  if (retrySubmitted && videoJob?.audio_status !== "failed") {
    setRetrySubmitted(false);
  }

  if (retrySubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center animate-[pulse_2.4s_ease-in-out_infinite]">
        <Loader2 size={28} className="text-blue-500 animate-spin" />
        <div className="text-sm text-foreground">AI 正在分析…</div>
        <div className="text-xs text-muted-foreground max-w-xs">已重新提交，状态将在下一次轮询同步</div>
      </div>
    );
  }

  if (videoJob?.audio_status === "failed") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={28} className="text-rose-500" />
        <div className="text-sm text-foreground">AI 分析失败</div>
        {videoJob.audio_error && (
          <div className="text-xs text-muted-foreground max-w-xs">{videoJob.audio_error}</div>
        )}
        <button
          onClick={async () => {
            // 立即把视图切到"分析中"，给用户即时反馈
            setRetrySubmitted(true);
            try {
              const res = await fetch(`/api/ai/video/${videoJob.id}/retry?step=audio`, { method: "POST" });
              if (!res.ok) throw new Error(await res.text().catch(() => "retry failed"));
              toast.success("已重新提交分析任务");
            } catch (err) {
              setRetrySubmitted(false);
              toast.error(err instanceof Error ? err.message : "重试失败");
            }
          }}
          className="mt-1 px-3 py-1.5 rounded-md bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs flex items-center gap-1.5"
        >
          <RotateCw size={12} />
          重新分析
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/15 dark:[&::-webkit-scrollbar-thumb]:bg-slate-200/10 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300/25 dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-200/18 [&::-webkit-scrollbar-thumb]:backdrop-blur-md [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:transition-colors">
      <KeywordsRow keywords={audio?.keywords} jobId={jobId} canEnrich={canEnrich} />
      <SummaryBlock summary={audio?.summary} />

      <section>
        <div className="border-b border-border/50 flex items-center gap-4 text-xs mb-3">
          {SUBTABS.map((t) => {
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={
                  active
                    ? "pb-2 font-medium text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-400 -mb-px"
                    : "pb-2 text-muted-foreground border-b-2 border-transparent hover:text-foreground -mb-px"
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {subTab === "chapters" && <ChaptersTab chapters={audio?.chapters} />}
        {subTab === "speakers" && (
          <SpeakerSummaryTab
            audio={audio}
            jobId={jobId}
            canEnrich={canEnrich}
            noteId={noteId}
          />
        )}
      </section>

      <p className="text-center text-[11px] text-muted-foreground pt-2 border-t border-border/50">
        智能内容由 AI 模型生成，仅供参考
      </p>
    </div>
  );
}
