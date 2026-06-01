"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VISIBLE_LIMIT = 10;

interface Props {
  keywords: string[] | undefined;
  jobId: string | null;
  canEnrich: boolean;
}

export function KeywordsRow({ keywords, jobId, canEnrich }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const enrich = async () => {
    if (!jobId) return;
    setEnriching(true);
    try {
      const res = await fetch(`/api/ai/video/${jobId}/enrich?fields=keywords`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "提取失败");
      }
      toast.success("关键词提取完成");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提取失败");
    } finally {
      setEnriching(false);
    }
  };

  if (!keywords?.length) {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">关键词</h3>
          {canEnrich && jobId && (
            <button
              onClick={enrich}
              disabled={enriching}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-60"
            >
              {enriching ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Sparkles size={11} />
              )}
              {enriching ? "提取中…" : "用 AI 提取"}
            </button>
          )}
        </div>
        {!canEnrich ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-16 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground py-2">
            AI 暂未提炼出关键词，可点击右上角「用 AI 提取」补齐。
          </div>
        )}
      </section>
    );
  }

  const list = expanded ? keywords : keywords.slice(0, VISIBLE_LIMIT);

  return (
    <section>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">关键词</h3>
      <div className="flex flex-wrap gap-1.5">
        {list.map((kw, i) => (
          <span
            key={i}
            className="px-3 py-1.5 rounded text-xs text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-900/40"
          >
            {kw}
          </span>
        ))}
        {keywords.length > VISIBLE_LIMIT && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 dark:text-blue-400 px-2 hover:underline"
          >
            {expanded ? "收起" : `展开全部 (${keywords.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
