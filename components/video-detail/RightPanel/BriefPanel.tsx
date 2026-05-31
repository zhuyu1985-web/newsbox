"use client";
import { useVideoDetailStore } from "../store";
import { KeywordsRow } from "./KeywordsRow";
import { SummaryBlock } from "./SummaryBlock";
import { ChaptersTab } from "./ChaptersTab";
import type { VideoJobRow } from "@/components/reader/ReaderPageWrapper";

const SUBTABS = [
  { key: "chapters", label: "章节速览" },
  { key: "speakers", label: "发言总结" },
  { key: "qa", label: "问答回顾" },
] as const;

export function BriefPanel({ videoJob }: { videoJob: VideoJobRow | null }) {
  const subTab = useVideoDetailStore((s) => s.activeBriefSubTab);
  const setSubTab = useVideoDetailStore((s) => s.setActiveBriefSubTab);
  const audio = videoJob?.audio_result;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-track]:bg-transparent">
      <KeywordsRow keywords={audio?.keywords} />
      <SummaryBlock summary={audio?.summary} />

      <section>
        <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs mb-3">
          {SUBTABS.map((t) => {
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={
                  active
                    ? "pb-2 font-medium text-violet-700 dark:text-violet-300 border-b-2 border-violet-600 dark:border-violet-400 -mb-px"
                    : "pb-2 text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-700 dark:hover:text-slate-200 -mb-px"
                }
              >
                {t.label}
                {t.key !== "chapters" && (
                  <span className="ml-1 text-[9px] text-slate-400 dark:text-slate-500">P1</span>
                )}
              </button>
            );
          })}
        </div>
        {subTab === "chapters" && <ChaptersTab chapters={audio?.chapters} />}
        {subTab === "speakers" && (
          <div className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
            发言总结 · 后续版本支持
          </div>
        )}
        {subTab === "qa" && (
          <div className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
            问答回顾 · 后续版本支持
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
        智能内容由 AI 模型生成，仅供参考
      </p>
    </div>
  );
}
