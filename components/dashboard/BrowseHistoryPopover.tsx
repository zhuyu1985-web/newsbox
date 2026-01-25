"use client";

import { useCallback, useEffect, useMemo, useState, type UIEvent, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { clearBrowseHistory, getBrowseHistory, type BrowseHistoryEntry } from "@/lib/browse-history";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

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
  onNavigateToNote,
  children,
}: {
  userId: string;
  // supabase prop removed as it was only used for cloud history
  supabase?: any;
  onNavigateToNote: (noteId: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const [localPage, setLocalPage] = useState(1);
  const localAll = useMemo(() => getBrowseHistory(userId), [userId, open]);
  const localItems = useMemo(
    () => localAll.slice(0, localPage * PAGE_SIZE),
    [localAll, localPage]
  );
  const localHasMore = localItems.length < localAll.length;

  useEffect(() => {
    if (!open) return;
    // reset each open
    setLocalPage(1);
  }, [open]);

  const onScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
      if (!nearBottom) return;

      if (localHasMore) setLocalPage((p) => p + 1);
    },
    [localHasMore]
  );

  const handleClear = useCallback(() => {
    clearBrowseHistory(userId);
    setLocalPage(1);
  }, [userId]);

  const itemsEmpty = localItems.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="w-[400px] p-0 overflow-hidden bg-white/95 backdrop-blur-md border-black/5 shadow-2xl rounded-2xl"
      >
        <div className="px-6 pt-5 pb-3 border-b border-black/5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              浏览历史
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-700 h-8 px-2"
              onClick={handleClear}
              disabled={localAll.length === 0}
            >
              清空
            </Button>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
