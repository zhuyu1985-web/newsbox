"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ExportDialog } from "./ExportDialog";

interface Props {
  noteId: string;
  isStarred: boolean;
}

export function LeftToolbar({ noteId, isStarred }: Props) {
  const router = useRouter();
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

  const ToolbarButton = ({
    Icon,
    label,
    onClick,
    active,
  }: {
    Icon: typeof Star;
    label: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={
        active
          ? "w-11 h-11 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex flex-col items-center justify-center gap-0.5 text-[10px]"
          : "w-11 h-11 rounded-lg hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-muted-foreground flex flex-col items-center justify-center gap-0.5 text-[10px]"
      }
      title={label}
    >
      <Icon size={16} fill={active && Icon === Star ? "currentColor" : "none"} />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="border-r border-border/50 bg-card/40 backdrop-blur-xl flex flex-col items-center py-3 gap-1 text-muted-foreground">
      <button
        onClick={() => router.back()}
        className="w-11 h-11 rounded-lg hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-muted-foreground flex items-center justify-center"
        title="返回"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="w-8 h-px bg-border my-2" />
      <ToolbarButton Icon={Star} label="收藏" onClick={toggleStar} active={starred} />
      <ToolbarButton Icon={Download} label="导出" onClick={() => setExportOpen(true)} />
      <ExportDialog noteId={noteId} open={exportOpen} onOpenChange={setExportOpen} />
    </aside>
  );
}
