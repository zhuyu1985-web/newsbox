"use client";

import { useEffect, useMemo, useState } from "react";
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
  contentType: Record<string, number>;
  topSavedDomains: Array<{ domain: string; count: number }>;
  topVisitedDomains: Array<{ domain: string; count: number }>;
};

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
      } catch (e: any) {
        setError(e?.message ?? "加载失败");
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
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            用量统计
          </h3>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : !stats ? (
            <div className="text-sm text-slate-500">暂无数据</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="加入天数" value={`${stats.joinedDays} 天`} />
                <Metric label="收藏卡片" value={stats.notesCount} />
                <Metric label="收藏夹数" value={stats.foldersCount} />
                <Metric label="智能列表数" value={stats.smartListsCount} />
                <Metric label="标签数量" value={stats.tagsCount} />
                <Metric label="标注数量" value={stats.annotationsCount} />
                <Metric label="笔记字数" value={stats.wordsCount} />
                <Metric label="累计访问次数" value={stats.visitsCount} />
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#f5f5f7] rounded-2xl p-6">
                  <div className="text-sm font-semibold text-slate-900 mb-4">
                    收藏卡片类型统计（柱状）
                  </div>
                  <div className="space-y-3">
                    {Object.entries(stats.contentType).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <div className="w-14 text-xs text-slate-600 capitalize">
                          {k}
                        </div>
                        <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden border border-black/5">
                          <div
                            className="h-full bg-[#2F6BFF] rounded-full"
                            style={{ width: `${Math.round((v / maxType) * 100)}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-xs text-slate-600">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-black/5 p-6">
                  <div className="text-sm font-semibold text-slate-900 mb-4">
                    收藏的网站来源 TOP 10
                  </div>
                  <TopList rows={stats.topSavedDomains} />
                </div>

                <div className="bg-white rounded-2xl border border-black/5 p-6 lg:col-span-2">
                  <div className="text-sm font-semibold text-slate-900 mb-4">
                    访问的网站来源 TOP 10
                  </div>
                  <TopList rows={stats.topVisitedDomains} />
                </div>
              </div>

              <div className="mt-4 text-[11px] text-slate-400">
                统计口径：包含已归档与已删除笔记；访问次数基于访问事件表 `note_visit_events`。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-[#f5f5f7] rounded-2xl p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-2">{value}</div>
    </div>
  );
}

function TopList({ rows }: { rows: Array<{ domain: string; count: number }> }) {
  if (!rows?.length) {
    return <div className="text-sm text-slate-500">暂无数据</div>;
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r, idx) => (
        <div key={r.domain} className="flex items-center gap-3">
          <div className="w-5 text-xs text-slate-400">{idx + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-800 truncate">{r.domain}</div>
            <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden mt-1 border border-black/5">
              <div
                className={cn("h-full rounded-full", idx < 3 ? "bg-[#2F6BFF]" : "bg-slate-300")}
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="w-10 text-right text-xs text-slate-600">{r.count}</div>
        </div>
      ))}
    </div>
  );
}


