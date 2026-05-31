"use client";
import { useState } from "react";

const COLLAPSED_CHARS = 220;

export function SummaryBlock({ summary }: { summary: string | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!summary) {
    return (
      <section>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">全文概要</h3>
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-muted animate-pulse"
              style={{ width: `${90 - i * 12}%` }}
            />
          ))}
        </div>
      </section>
    );
  }

  const tooLong = summary.length > COLLAPSED_CHARS;
  const visible = expanded || !tooLong ? summary : summary.slice(0, COLLAPSED_CHARS) + "...";

  return (
    <section>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">全文概要</h3>
      <p className="text-sm text-foreground leading-relaxed">
        {visible}
        {tooLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 dark:text-blue-400 ml-1 hover:underline"
          >
            {expanded ? "收起" : "展开全部"}
          </button>
        )}
      </p>
    </section>
  );
}
