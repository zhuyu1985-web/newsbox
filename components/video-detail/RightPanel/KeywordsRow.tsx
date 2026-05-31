"use client";
import { useState } from "react";

const VISIBLE_LIMIT = 10;

export function KeywordsRow({ keywords }: { keywords: string[] | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!keywords?.length) {
    return (
      <section>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">关键词</h3>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-16 rounded bg-muted animate-pulse"
            />
          ))}
        </div>
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
