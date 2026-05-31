"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileType, FileJson } from "lucide-react";

type ExportFormat = "md" | "srt" | "json";

const FORMATS: ReadonlyArray<{
  key: ExportFormat;
  label: string;
  desc: string;
  Icon: typeof FileText;
}> = [
  { key: "md", label: "Markdown", desc: "包含标题/概要/章节/原文/笔记", Icon: FileText },
  { key: "srt", label: "字幕文件", desc: "标准 SRT 字幕，适合给视频做字幕", Icon: FileType },
  { key: "json", label: "完整数据 (JSON)", desc: "原始数据备份，便于迁移", Icon: FileJson },
];

export function ExportDialog({
  noteId,
  open,
  onOpenChange,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("md");

  const handleExport = () => {
    window.location.href = `/api/notes/${noteId}/export?format=${format}`;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出笔记</DialogTitle>
          <DialogDescription>选择导出格式，文件会下载到本地。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {FORMATS.map((f) => {
            const active = format === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
                className={
                  active
                    ? "w-full flex items-start gap-3 p-3 rounded-xl border-2 border-blue-500 dark:border-blue-400 bg-blue-50/60 dark:bg-blue-950/40 text-left"
                    : "w-full flex items-start gap-3 p-3 rounded-xl border border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 text-left"
                }
              >
                <f.Icon
                  size={20}
                  className={
                    active
                      ? "text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
                      : "text-muted-foreground shrink-0 mt-0.5"
                  }
                />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-foreground">{f.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleExport}>导出</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
