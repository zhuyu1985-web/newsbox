"use client";
import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function TitleEditor({
  noteId,
  initialTitle,
}: {
  noteId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle || "未命名视频");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const enter = () => {
    setDraft(title);
    setEditing(true);
  };
  const cancel = () => {
    setDraft(title);
    setEditing(false);
  };
  const save = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("notes")
        .update({ title: next })
        .eq("id", noteId);
      if (error) throw error;
      setTitle(next);
      setEditing(false);
      toast.success("标题已更新");
    } catch {
      toast.error("更新失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") cancel();
          }}
          disabled={saving}
          className="flex-1 min-w-0 text-sm font-semibold bg-background border border-blue-400 dark:border-blue-500 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 text-foreground"
          maxLength={300}
        />
        <button
          onClick={save}
          disabled={saving}
          className="w-7 h-7 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
          title="保存"
        >
          <Check size={14} />
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="w-7 h-7 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 disabled:opacity-50"
          title="取消"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={enter}
      className="group flex items-center gap-1.5 text-left min-w-0 max-w-full hover:bg-blue-50/50 dark:hover:bg-blue-950/30 rounded px-1.5 py-0.5 -mx-1.5"
      title="点击编辑标题"
    >
      <span className="text-sm font-semibold truncate text-foreground">{title}</span>
      <Pencil
        size={12}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0"
      />
    </button>
  );
}
