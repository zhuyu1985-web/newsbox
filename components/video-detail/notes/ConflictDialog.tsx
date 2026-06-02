"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function ConflictDialog({
  open,
  remoteUpdatedAt,
  onOverwrite,
  onReload,
  onCancel,
}: {
  open: boolean;
  remoteUpdatedAt: string | null;
  onOverwrite: () => void;
  onReload: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="text-amber-500" size={20} />
            笔记内容冲突
          </DialogTitle>
          <DialogDescription>
            检测到该笔记在另一处被修改过
            {remoteUpdatedAt
              ? `（${new Date(remoteUpdatedAt).toLocaleString()}）`
              : ""}
            。请选择如何处理：
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-foreground">
          <p>
            <strong className="text-blue-600 dark:text-blue-400">
              重新加载
            </strong>
            ：放弃当前本地的修改，载入远端最新内容（推荐）
          </p>
          <p>
            <strong className="text-rose-600 dark:text-rose-400">覆盖</strong>
            ：保留当前本地修改，覆盖远端版本（远端修改会丢失）
          </p>
          <p>
            <strong className="text-muted-foreground">取消</strong>
            ：暂不处理，可继续编辑（下次保存会再次检查）
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="destructive" onClick={onOverwrite}>
            覆盖
          </Button>
          <Button
            onClick={onReload}
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            重新加载
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
