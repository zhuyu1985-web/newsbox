"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Star, LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MobileSheet } from "./MobileSheet";
import { ExportDialog } from "./ExportDialog";
import { useVideoDetailStore } from "./store";

interface Props {
  noteId: string;
  isStarred: boolean;
}

/**
 * MobileMoreMenu
 * - 复用 LeftToolbar 的逻辑（返回 / 收藏 / 导出）
 * - 在 < lg 视口下，作为「更多」tab 弹出的底部抽屉显示
 */
export function MobileMoreMenu({ noteId, isStarred }: Props) {
  const router = useRouter();
  const open = useVideoDetailStore((s) => s.mobileSheetOpen) === "more";
  const setOpen = useVideoDetailStore((s) => s.setMobileSheetOpen);
  const [exportOpen, setExportOpen] = useState(false);
  const [starred, setStarred] = useState(isStarred);

  const toggleStar = async () => {
    const next = !starred;
    setStarred(next);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("notes")
        .update({ is_starred: next })
        .eq("id", noteId);
      if (error) throw error;
      toast.success(next ? "已收藏" : "已取消收藏");
    } catch {
      setStarred(!next);
      toast.error("收藏失败，请重试");
    }
  };

  const Row = ({
    Icon,
    label,
    onClick,
    active,
  }: {
    Icon: LucideIcon;
    label: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={
        active
          ? "w-full flex items-center gap-3 px-4 py-3 text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/30"
          : "w-full flex items-center gap-3 px-4 py-3 text-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40"
      }
    >
      <Icon size={18} fill={active && Icon === Star ? "currentColor" : "none"} />
      <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <>
      <MobileSheet
        open={open}
        onClose={() => setOpen(null)}
        title="更多"
        height="50vh"
      >
        <div className="flex-1 overflow-y-auto py-2">
          <Row
            Icon={ArrowLeft}
            label="返回"
            onClick={() => {
              setOpen(null);
              router.back();
            }}
          />
          <Row Icon={Star} label="收藏" onClick={toggleStar} active={starred} />
          <Row
            Icon={Download}
            label="导出"
            onClick={() => {
              setOpen(null);
              setExportOpen(true);
            }}
          />
        </div>
      </MobileSheet>
      <ExportDialog noteId={noteId} open={exportOpen} onOpenChange={setExportOpen} />
    </>
  );
}
