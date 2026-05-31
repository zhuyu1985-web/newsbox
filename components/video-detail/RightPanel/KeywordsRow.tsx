"use client";
import { useState } from "react";

const VISIBLE_LIMIT = 10;

export function KeywordsRow({ keywords }: { keywords: string[] | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!keywords?.length) {
    return (
      <section>
        <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">关键词</h3>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  const list = expanded ? keywords : keywords.slice(0, VISIBLE_LIMIT);

  return (
    <section>
      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">关键词</h3>
      <div className="flex flex-wrap gap-1.5">
        {list.map((kw, i) => (
          <span
            key={i}
            className="px-3 py-1.5 rounded text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 border border-violet-100 dark:border-violet-900"
          >
            {kw}
          </span>
        ))}
        {keywords.length > VISIBLE_LIMIT && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-violet-600 dark:text-violet-400 px-2 hover:underline"
          >
            {expanded ? "收起" : `展开全部 (${keywords.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
