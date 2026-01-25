"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { clearBrowseHistory, getBrowseHistory, type BrowseHistoryEntry } from "@/lib/browse-history";
import { Button } from "@/components/ui/button";
import { FileText, Globe, Info, Loader2 } from "lucide-react";

type CloudHistoryItem = {
  id: string;
  title: string | null;
  site_name: string | null;
  content_type: "article" | "video" | "audio" | null;
  last_accessed_at: string | null;
};

type TabKey = "local" | "cloud";

const PAGE_SIZE = 15;

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BrowseHistoryPopover({
  userId,
  supabase,
  onNavigateToNote,
  children,
}: {
  userId: string;
  supabase?: any;
  onNavigateToNote: (noteId: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("local");

  // local
  const [localPage, setLocalPage] = useState(1);
  const localAll = useMemo(() => getBrowseHistory(userId), [userId, open]);
  const localItems = useMemo(
    () => localAll.slice(0, localPage * PAGE_SIZE),
    [localAll, localPage]
  );
  const localHasMore = localItems.length < localAll.length;

  // cloud
  const [cloudItems, setCloudItems] = useState<CloudHistoryItem[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudHasMore, setCloudHasMore] = useState(true);
  const cloudOffsetRef = useRef(0);

  const loadMoreCloud = useCallback(async () => {
    if (!supabase || cloudLoading || !cloudHasMore) return;
    setCloudLoading(true);
    try {
      const from = cloudOffsetRef.current;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("notes")
        .select("id,title,site_name,content_type,last_accessed_at")
        .eq("user_id", userId)
        .order("last_accessed_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      const rows = (data ?? []) as CloudHistoryItem[];
      setCloudItems((prev) => [...prev, ...rows]);
      cloudOffsetRef.current = from + rows.length;
      if (rows.length < PAGE_SIZE) setCloudHasMore(false);
    } finally {
      setCloudLoading(false);
    }
  }, [supabase, cloudLoading, cloudHasMore, userId]);

  useEffect(() => {
    if (!open) return;
    // reset each open
    setLocalPage(1);
    setTab("local");
    setCloudItems([]);
    setCloudHasMore(true);
    cloudOffsetRef.current = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (tab !== "cloud") return;
    if (cloudItems.length === 0) loadMoreCloud();
  }, [open, tab, cloudItems.length, loadMoreCloud]);

  const onScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
      if (!nearBottom) return;

      if (tab === "local") {
        if (localHasMore) setLocalPage((p) => p + 1);
      } else {
        void loadMoreCloud();
      }
    },
    [tab, localHasMore, loadMoreCloud]
  );

  const handleClear = useCallback(() => {
    clearBrowseHistory(userId);
    setLocalPage(1);
  }, [userId]);

  const itemsEmpty =
    tab === "local" ? localItems.length === 0 : cloudItems.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-[480px] p-0 overflow-hidden bg-white/95 backdrop-blur-md border-black/5 shadow-2xl rounded-2xl"
      >
        <div className="px-6 pt-5 pb-3 border-b border-black/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <button
                className={cn(
                  "text-base font-semibold tracking-tight pb-2 border-b-[2px] transition-colors",
                  tab === "local"
                    ? "text-[#2F6BFF] border-[#2F6BFF]"
                    : "text-slate-900/70 dark:text-white/70 border-transparent hover:text-slate-900 dark:hover:text-white"
                )}
                onClick={() => setTab("local")}
              >
                浏览历史
              </button>
              <button
                className={cn(
                  "text-base font-semibold tracking-tight pb-2 border-b-[2px] transition-colors flex items-center gap-1.5",
                  tab === "cloud"
                    ? "text-slate-900 dark:text-white border-slate-900/30 dark:border-white/30"
                    : "text-slate-900/70 dark:text-white/70 border-transparent hover:text-slate-900 dark:hover:text-white"
                )}
                onClick={() => setTab("cloud")}
              >
                浏览器云端历史
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>

            {tab === "local" ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-700 h-8 px-2"
                onClick={handleClear}
                disabled={localAll.length === 0}
              >
                清空
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className="h-[400px] overflow-y-auto px-4 py-2"
          onScroll={onScroll}
        >
          {itemsEmpty ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              暂无浏览记录
            </div>
          ) : null}

          {tab === "local" ? (
            <div className="space-y-1">
              {localItems.map((it: BrowseHistoryEntry) => (
                <button
                  key={`${it.noteId}-${it.visitedAt}`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 transition-colors text-left group"
                  onClick={() => {
                    setOpen(false);
                    onNavigateToNote(it.noteId);
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center shrink-0 group-hover:bg-white/80 transition-colors">
                    <FileText className="h-4 w-4 text-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {it.title || "无标题"}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="truncate max-w-[120px]">
                        {it.siteName || "未知来源"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{formatDateTime(it.visitedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
              {localHasMore ? (
                <div className="py-2 text-center text-[10px] text-slate-400">
                  下拉加载更多…
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              {cloudItems.map((it) => (
                <button
                  key={it.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 transition-colors text-left group"
                  onClick={() => {
                    setOpen(false);
                    onNavigateToNote(it.id);
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center shrink-0 group-hover:bg-white/80 transition-colors">
                    <Globe className="h-4 w-4 text-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {it.title || "无标题"}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="truncate max-w-[120px]">
                        {it.site_name || "未知来源"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{formatDateTime(it.last_accessed_at)}</span>
                    </div>
                  </div>
                </button>
              ))}
              {cloudLoading ? (
                <div className="py-2 flex items-center justify-center text-[10px] text-slate-400 gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  加载中…
                </div>
              ) : cloudHasMore ? (
                <div className="py-2 text-center text-[10px] text-slate-400">
                  下拉加载更多…
                </div>
              ) : null}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
