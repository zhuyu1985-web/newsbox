"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Stats = {
  joinedDays: number;
  notesCount: number;
  foldersCount: number;
  smartListsCount: number;
  tagsCount: number;
  annotationsCount: number;
  wordsCount: number;
  visitsCount: number;
  aiOutputsCount: number;
  aiSnapshotsCount: number;
  aiEstimatedTokensCount: number;
  contentType: Record<string, number>;
  topSavedDomains: Array<{ domain: string; count: number }>;
  topVisitedDomains: Array<{ domain: string; count: number }>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "加载失败";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function StatsSection() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settings/stats");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "加载失败");
        setStats(json as Stats);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maxType = useMemo(() => {
    if (!stats) return 0;
    return Math.max(1, ...Object.values(stats.contentType || {}));
  }, [stats]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-card-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            用量统计
          </h3>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : !stats ? (
            <div className="text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="加入天数" value={`${stats.joinedDays} 天`} />
                <Metric label="收藏卡片" value={stats.notesCount} />
                <Metric label="收藏夹数" value={stats.foldersCount} />
                <Metric label="智能列表数" value={stats.smartListsCount} />
                <Metric label="标签数量" value={stats.tagsCount} />
                <Metric label="标注数量" value={stats.annotationsCount} />
                <Metric label="笔记字数" value={formatNumber(stats.wordsCount)} />
                <Metric label="累计访问次数" value={formatNumber(stats.visitsCount)} />
                <Metric
                  label="AI Token（估算）"
                  value={formatNumber(stats.aiEstimatedTokensCount)}
                  hint={`${stats.aiOutputsCount + stats.aiSnapshotsCount} 条 AI 产物`}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-muted/70 rounded-2xl p-6">
                  <div className="text-sm font-semibold text-card-foreground mb-4">
                    收藏卡片类型统计（柱状）
                  </div>
                  <div className="space-y-3">
                    {Object.entries(stats.contentType).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <div className="w-14 text-xs text-card-foreground capitalize">
                          {k}
                        </div>
                        <div className="flex-1 h-2.5 bg-background rounded-full overflow-hidden border border-border">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${Math.round((v / maxType) * 100)}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-xs text-card-foreground">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="text-sm font-semibold text-card-foreground mb-4">
                    收藏的网站来源 TOP 10
                  </div>
                  <TopList rows={stats.topSavedDomains} />
                </div>

                <div className="bg-card rounded-2xl border border-border p-6 lg:col-span-2">
                  <div className="text-sm font-semibold text-card-foreground mb-4">
                    访问的网站来源 TOP 10
                  </div>
                  <TopList rows={stats.topVisitedDomains} />
                </div>
              </div>

              <div className="mt-4 text-[11px] text-muted-foreground/70">
                统计口径：包含已归档与已删除笔记；访问次数基于访问事件表 `note_visit_events`；Token 为历史 AI 输出内容估算值。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-muted/70 rounded-2xl p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold text-card-foreground mt-2">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function TopList({ rows }: { rows: Array<{ domain: string; count: number }> }) {
  if (!rows?.length) {
    return <div className="text-sm text-muted-foreground">暂无数据</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r, idx) => (
        <div key={r.domain} className="flex items-center gap-3">
          <div className="w-5 text-xs text-muted-foreground/70">{idx + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-card-foreground truncate">{r.domain}</div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mt-1 border border-border">
              <div
                className={cn("h-full rounded-full", idx < 3 ? "bg-blue-600" : "bg-slate-400 dark:bg-slate-600")}
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="w-10 text-right text-xs text-card-foreground">{r.count}</div>
        </div>
      ))}
    </div>
  );
}
