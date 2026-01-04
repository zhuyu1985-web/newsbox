"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

type DeletedNote = {
  id: string;
  title: string | null;
  site_name: string | null;
  source_url: string | null;
  deleted_at: string;
};

export function TrashSection() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DeletedNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/trash");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "加载失败");
      setItems(json.items || []);
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/settings/trash/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "恢复失败");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "恢复失败");
    } finally {
      setBusyId(null);
    }
  };

  const permanentDelete = async (id: string) => {
    if (!confirm("确认永久删除？该操作不可恢复。")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/settings/trash/${id}/delete`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "删除失败");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">最近删除</h3>
          <Button variant="outline" size="sm" onClick={load}>
            刷新
          </Button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">暂无最近删除记录</div>
          ) : (
            <div className="space-y-2">
              {items.map((n) => (
                <div
                  key={n.id}
                  className="bg-[#f5f5f7] rounded-2xl p-5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {n.title || "无标题"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span className="truncate max-w-[180px]">
                        {n.site_name || "未知来源"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{new Date(n.deleted_at).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restore(n.id)}
                      disabled={busyId === n.id}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      恢复
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => permanentDelete(n.id)}
                      disabled={busyId === n.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      永久删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


