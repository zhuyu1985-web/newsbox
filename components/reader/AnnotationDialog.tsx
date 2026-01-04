"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface AnnotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  highlightId?: string;
  selectedText: string;
  timecode?: number;
  screenshotUrl?: string;
  onSuccess?: () => void;
}

export function AnnotationDialog({
  open,
  onOpenChange,
  noteId,
  highlightId,
  selectedText,
  timecode,
  screenshotUrl,
  onSuccess,
}: AnnotationDialogProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const handleSave = async () => {
    if (!note.trim()) {
      return;
    }

    setSaving(true);
    try {
      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      // 保存批注
      const { error } = await supabase.from("annotations").insert({
        user_id: user.id,
        note_id: noteId,
        highlight_id: highlightId,
        content: note.trim(),
        timecode,
        screenshot_url: screenshotUrl,
      });

      if (error) throw error;

      // 成功后关闭对话框并触发刷新
      setNote("");
      onOpenChange(false);
      
      // 通知右侧面板刷新，如果有 highlightId 则定位到对应位置
      if (highlightId) {
        window.dispatchEvent(new CustomEvent("reader:scroll-to-highlight", { 
          detail: { highlightId } 
        }));
      }
      window.dispatchEvent(new CustomEvent("reader:refresh-highlights"));
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to save annotation:", error);
      alert("保存批注失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>添加批注</DialogTitle>
          <DialogDescription>
            为选中的文字添加您的笔记和想法
          </DialogDescription>
        </DialogHeader>

        {/* 引用的文字 */}
        <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-primary">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-muted-foreground">引用文字：</p>
            {timecode !== undefined && (
              <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {Math.floor(timecode / 60).toString().padStart(2, "0")}:
                {Math.floor(timecode % 60).toString().padStart(2, "0")}
              </span>
            )}
          </div>
          <p className="text-foreground leading-relaxed">{selectedText}</p>
          
          {screenshotUrl && (
            <div className="mt-3 rounded-md overflow-hidden border border-muted">
              <img src={screenshotUrl} alt="Video frame" className="w-full h-auto" />
            </div>
          )}
        </div>

        {/* 批注输入 */}
        <div className="space-y-2">
          <label htmlFor="annotation-note" className="text-sm font-medium">
            您的批注
          </label>
          <Textarea
            id="annotation-note"
            placeholder="写下您的想法、评论或笔记..."
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            rows={6}
            className="resize-none"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            已输入 {note.length} 个字符
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setNote("");
              onOpenChange(false);
            }}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !note.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存批注
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

