"use client";
import { useEffect, useRef, useState } from "react";
import { Languages, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoDetailStore } from "./store";
import type { TranscriptSegment } from "@/lib/ai-analysis/types";

type Lang = "en" | "ja" | "ko" | "auto-zh";
const LANGUAGES: Array<{ key: Lang; label: string }> = [
  { key: "en", label: "英文 (English)" },
  { key: "ja", label: "日本語" },
  { key: "ko", label: "한국어" },
  { key: "auto-zh", label: "翻译为中文" },
];

export function TranslationPopover({ transcript }: { transcript: TranscriptSegment[] }) {
  const open = useVideoDetailStore((s) => s.translationOpen);
  const target = useVideoDetailStore((s) => s.translationTarget);
  const mode = useVideoDetailStore((s) => s.translationMode);
  const loading = useVideoDetailStore((s) => s.translationLoading);
  const setOpen = useVideoDetailStore((s) => s.setTranslationOpen);
  const setTarget = useVideoDetailStore((s) => s.setTranslationTarget);
  const setMode = useVideoDetailStore((s) => s.setTranslationMode);
  const setTranslations = useVideoDetailStore((s) => s.setTranslations);
  const setLoading = useVideoDetailStore((s) => s.setTranslationLoading);
  const clearTranslations = useVideoDetailStore((s) => s.clearTranslations);

  const [selectedLang, setSelectedLang] = useState<Lang>("en");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, setOpen]);

  const translate = async () => {
    if (transcript.length === 0) {
      toast.error("暂无原文可翻译");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/video/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: transcript.map((s) => s.text),
          targetLang: selectedLang,
        }),
      });
      if (!res.ok) throw new Error("translate failed");
      const json = (await res.json()) as { translations: string[] };
      const map: Record<number, string> = {};
      json.translations.forEach((t, i) => (map[i] = t));
      setTranslations(map);
      setTarget(selectedLang);
      toast.success("翻译完成");
      setOpen(false);
    } catch {
      toast.error("翻译失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-12 w-80 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl z-50 p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Languages size={14} />
          翻译
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-5 h-5 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center text-muted-foreground"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">目标语言</div>
          <div className="grid grid-cols-2 gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.key}
                onClick={() => setSelectedLang(l.key)}
                className={
                  selectedLang === l.key
                    ? "px-2 py-1.5 rounded text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700"
                    : "px-2 py-1.5 rounded text-[11px] text-muted-foreground border border-border/50 hover:border-blue-300 dark:hover:border-blue-700"
                }
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">显示方式</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode("bilingual")}
              className={
                mode === "bilingual"
                  ? "flex-1 px-2 py-1.5 rounded text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700"
                  : "flex-1 px-2 py-1.5 rounded text-[11px] text-muted-foreground border border-border/50"
              }
            >
              双语显示
            </button>
            <button
              onClick={() => setMode("target-only")}
              className={
                mode === "target-only"
                  ? "flex-1 px-2 py-1.5 rounded text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700"
                  : "flex-1 px-2 py-1.5 rounded text-[11px] text-muted-foreground border border-border/50"
              }
            >
              纯译文
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={translate}
            disabled={loading}
            className="flex-1 px-3 py-1.5 rounded-md bg-blue-600 dark:bg-blue-500 text-white text-xs hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            {loading ? "翻译中…" : target ? "重新翻译" : "翻译"}
          </button>
          {target && (
            <button
              onClick={() => {
                clearTranslations();
                toast.success("已清除翻译");
              }}
              className="px-2 py-1.5 rounded-md border border-border/50 text-xs text-muted-foreground hover:bg-blue-50/60 dark:hover:bg-blue-950/40"
            >
              清除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
