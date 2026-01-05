"use client";

import { useEffect, useState } from "react";
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

interface EditAnnotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotation: any; // Using any to avoid complex type imports
  onSuccess: (newContent?: string) => void;
}

export function EditAnnotationDialog({
  open,
  onOpenChange,
  annotation,
  onSuccess,
}: EditAnnotationDialogProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  // Initialize note content when annotation changes
  useEffect(() => {
    if (annotation) {
      setNote(annotation.content || "");
    }
  }, [annotation]);

  const handleSave = async () => {
    if (!note.trim()) {
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登录");

      const { error } = await supabase
        .from("annotations")
        .update({
          content: note.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", annotation.id);

      if (error) throw error;

      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess(note.trim());
      }
    } catch (error) {
      console.error("Failed to update annotation:", error);
      alert("更新批注失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (!annotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>查看/编辑批注</DialogTitle>
          <DialogDescription>
            查看详情或修改您的批注内容
          </DialogDescription>
        </DialogHeader>

        {/* Quote */}
        {annotation.highlights?.quote && (
          <div className="bg-muted/50 p-4 rounded-lg border-l-4" style={{ borderLeftColor: annotation.highlights.color || '#fef08a' }}>
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm text-muted-foreground">引用文字：</p>
              {annotation.timecode !== undefined && annotation.timecode !== null && (
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {Math.floor(annotation.timecode / 60).toString().padStart(2, "0")}:
                  {Math.floor(annotation.timecode % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>
            <p className="text-foreground leading-relaxed text-sm">{annotation.highlights.quote}</p>
            
            {annotation.screenshot_url && (
              <div className="mt-3 rounded-md overflow-hidden border border-muted">
                <img src={annotation.screenshot_url} alt="Screenshot" className="w-full h-auto" />
              </div>
            )}
          </div>
        )}

        {/* Note Input */}
        <div className="space-y-2">
          <label htmlFor="edit-annotation-note" className="text-sm font-medium">
            您的批注
          </label>
          <Textarea
            id="edit-annotation-note"
            placeholder="写下您的想法..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            className="resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>最后更新: {new Date(annotation.updated_at || annotation.created_at).toLocaleString('zh-CN')}</span>
            <span>{note.length} 字符</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !note.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
