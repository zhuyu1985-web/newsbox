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
import { Sparkles, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";

const STYLES = [
  { key: "conversational", label: "口语化" },
  { key: "formal", label: "书面" },
  { key: "concise", label: "简洁" },
  { key: "detailed", label: "详细" },
] as const;

export function AIRewriteDialog({
  open,
  onOpenChange,
  editor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editor: Editor | null;
}) {
  const [style, setStyle] = useState<(typeof STYLES)[number]["key"]>("conversational");
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState("");
  const [rewritten, setRewritten] = useState("");

  const handleOpen = (v: boolean) => {
    if (v && editor) {
      const text = editor.getText().trim();
      setOriginal(text);
      setRewritten("");
    }
    onOpenChange(v);
  };

  const run = async () => {
    if (!original) {
      toast.error("笔记为空，先写点东西再改写");
      return;
    }
    setLoading(true);
    setRewritten("");
    try {
      const res = await fetch("/api/ai/video/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: original, style }),
      });
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { rewritten: string };
      setRewritten(json.rewritten);
    } catch {
      toast.error("AI 改写失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const adopt = () => {
    if (!editor || !rewritten) return;
    editor.commands.focus("end");
    editor.commands.insertContent([
      { type: "horizontalRule" },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: rewritten,
            marks: [{ type: "italic" }],
          },
        ],
      },
    ]);
    toast.success("已采用并追加到笔记");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Sparkles size={18} className="text-blue-500" />
            AI 改写
          </DialogTitle>
          <DialogDescription>
            选择风格，AI 会根据你的笔记内容生成改写版本。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1.5">风格</div>
            <div className="flex gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  disabled={loading}
                  className={
                    style === s.key
                      ? "px-3 py-1.5 rounded text-xs text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700"
                      : "px-3 py-1.5 rounded text-xs text-muted-foreground border border-border/50 hover:border-blue-300 dark:hover:border-blue-700"
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">原文</div>
              <div className="h-48 overflow-y-auto rounded-lg border border-border/50 bg-card/40 backdrop-blur-md p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {original || (
                  <span className="text-muted-foreground italic">笔记为空</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1.5">改写结果</div>
              <div className="h-48 overflow-y-auto rounded-lg border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20 p-3 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {loading && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" />
                    AI 生成中…
                  </span>
                )}
                {!loading && !rewritten && (
                  <span className="text-muted-foreground italic">
                    点击下方“改写”开始
                  </span>
                )}
                {!loading && rewritten}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="outline" onClick={run} disabled={loading || !original}>
            <RotateCw size={12} className="mr-1.5" />
            {rewritten ? "重新生成" : "改写"}
          </Button>
          <Button onClick={adopt} disabled={!rewritten}>
            采用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
