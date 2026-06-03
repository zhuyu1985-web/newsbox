"use client";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMarkers, type MarkerKind } from "./hooks/useMarkers";
import { useVideoDetailStore } from "./store";
import { MARKER_LABEL } from "./shared/marker-styles";
import type { AudioAnalysisResult } from "@/lib/ai-analysis/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noteId: string;
  audio: AudioAnalysisResult | null | undefined;
}

const ALL_KINDS: MarkerKind[] = ["important", "question", "todo"];

function formatMmSs(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * ExcerptDialog
 * - 用户在顶栏点「摘取 > 摘取标记内容」打开本弹窗
 * - 选择 marker_kind（默认全选）+ 选项：发言人信息 / 时间戳信息（默认都开）
 * - 「确定」：按时间序生成 TimeReference 节点序列插入到笔记编辑器
 */
export function ExcerptDialog({ open, onOpenChange, noteId, audio }: Props) {
  const { markers } = useMarkers(noteId);
  const editor = useVideoDetailStore((s) => s.notesEditor);
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);
  const [selectedKinds, setSelectedKinds] = useState<Set<MarkerKind>>(
    new Set(ALL_KINDS),
  );
  const [includeSpeaker, setIncludeSpeaker] = useState(true);
  const [includeTime, setIncludeTime] = useState(true);

  const transcript = audio?.transcript ?? [];
  const qaPairs = audio?.qaPairs ?? [];
  const speakerSummaries = audio?.speakerSummaries ?? [];
  const speakers = audio?.speakers ?? [];

  const candidates = useMemo(() => {
    const out: Array<{
      kind: MarkerKind;
      time: number;
      speakerLabel: string | null;
      text: string;
    }> = [];
    for (const m of markers) {
      if (!selectedKinds.has(m.marker_kind)) continue;
      let text = "";
      let time = m.anchor_time ?? 0;
      let speakerLabel: string | null = null;
      if (m.target_type === "transcript" && m.segment_idx != null) {
        const seg = transcript[m.segment_idx];
        if (!seg) continue;
        // 选段标记 → 只取选中文本；整段 → 取整段文本
        text = m.selection_text || seg.text;
        time = seg.start;
        speakerLabel = seg.speaker ? `发言人 ${seg.speaker}` : null;
      } else if (m.target_type === "qa" && m.segment_idx != null) {
        const qa = qaPairs[m.segment_idx];
        if (!qa) continue;
        text = `${qa.q}\n— ${qa.a}`;
        time = typeof qa.anchorTime === "number" ? qa.anchorTime : 0;
      } else if (
        m.target_type === "speaker" &&
        m.segment_idx != null &&
        m.speaker_id
      ) {
        const sp = speakerSummaries.find((s) => s.speakerId === m.speaker_id);
        if (!sp) continue;
        text = sp.points[m.segment_idx] ?? "";
        speakerLabel =
          speakers.find((x) => x.id === m.speaker_id)?.label ??
          `发言人 ${m.speaker_id}`;
      }
      if (!text) continue;
      out.push({ kind: m.marker_kind, time, speakerLabel, text });
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }, [markers, selectedKinds, transcript, qaPairs, speakerSummaries, speakers]);

  const toggleKind = (k: MarkerKind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const insert = () => {
    if (!editor) {
      toast.error("编辑器未就绪");
      return;
    }
    if (candidates.length === 0) {
      toast.error("没有可摘取的标记内容");
      return;
    }
    setActiveTab("notes");
    setTimeout(() => {
      editor.commands.focus("end");
      // 写个小标题
      editor.commands.insertContent({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: `摘取的标记内容（${candidates.length} 条）` }],
      });
      for (const c of candidates) {
        const label = includeSpeaker ? c.speakerLabel : null;
        const prefix = includeTime ? "" : ""; // TimeReference 节点本身就含 time
        editor.commands.insertContent({
          type: "timeReference",
          attrs: {
            videoTime: includeTime ? c.time : 0,
            speakerLabel: label ? `${MARKER_LABEL[c.kind]} · ${label}` : MARKER_LABEL[c.kind],
            excerpt: `${prefix}${c.text}`,
          },
        });
      }
      editor.commands.createParagraphNear();
      toast.success(`已摘取 ${candidates.length} 条`);
      onOpenChange(false);
    }, 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>摘取标记内容到笔记</DialogTitle>
          <DialogDescription>
            按你之前在原文 / 问答 / 发言总结里标注的内容批量摘到笔记区。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              选择标记类型
            </div>
            <div className="flex gap-2">
              {ALL_KINDS.map((k) => {
                const checked = selectedKinds.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKind(k)}
                    className={
                      checked
                        ? "px-3 py-1.5 rounded-md text-xs bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                        : "px-3 py-1.5 rounded-md text-xs text-muted-foreground border border-border/60"
                    }
                  >
                    {MARKER_LABEL[k]}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="text-xs font-medium text-muted-foreground mb-2">
              附加信息
            </div>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSpeaker}
                  onChange={(e) => setIncludeSpeaker(e.target.checked)}
                  className="accent-blue-600"
                />
                <span>发言人信息</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTime}
                  onChange={(e) => setIncludeTime(e.target.checked)}
                  className="accent-blue-600"
                />
                <span>时间戳信息</span>
              </label>
            </div>
          </section>

          <section className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            将摘取 <span className="text-foreground font-medium">{candidates.length}</span> 条标记内容
            {candidates.length > 0 && (
              <div className="mt-1 text-[11px]">
                时间范围：{formatMmSs(candidates[0].time)} ~{" "}
                {formatMmSs(candidates[candidates.length - 1].time)}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={insert} disabled={candidates.length === 0}>
            确定摘取
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
