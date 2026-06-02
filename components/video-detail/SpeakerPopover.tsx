"use client";
import { useState, useRef, useEffect } from "react";
import { Users, Check } from "lucide-react";
import { useVideoDetailStore } from "./store";

interface Speaker {
  id: string;
  label: string;
}

export function SpeakerPopover({ speakers }: { speakers: Speaker[] }) {
  const [open, setOpen] = useState(false);
  const selected = useVideoDetailStore((s) => s.selectedSpeakers);
  const toggle = useVideoDetailStore((s) => s.toggleSpeaker);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!speakers.length) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-center text-muted-foreground"
        title="发言人筛选"
      >
        <Users size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-56 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-xl py-1.5 z-50">
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
            发言人筛选（共 {speakers.length} 位）
          </div>
          {speakers.map((sp) => {
            const isVisible = selected.size === 0 || selected.has(sp.id);
            return (
              <button
                key={sp.id}
                onClick={() => toggle(sp.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-foreground"
              >
                <span
                  className={
                    isVisible
                      ? "w-4 h-4 rounded border border-blue-500 bg-blue-500 dark:bg-blue-400 flex items-center justify-center"
                      : "w-4 h-4 rounded border border-border"
                  }
                >
                  {isVisible && <Check size={10} className="text-white" />}
                </span>
                {sp.label}
              </button>
            );
          })}
          {selected.size > 0 && (
            <div className="px-3 pt-1 pb-0.5 border-t border-border/50 mt-1">
              <button
                onClick={() =>
                  speakers.forEach((sp) => selected.has(sp.id) && toggle(sp.id))
                }
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                全部显示
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
