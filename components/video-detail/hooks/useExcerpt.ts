"use client";
import { useCallback } from "react";
import { useVideoDetailStore } from "../store";

export interface ExcerptPayload {
  excerpt: string;
  videoTime: number;
  speakerLabel?: string | null;
}

export function useExcerpt() {
  const setActiveTab = useVideoDetailStore((s) => s.setActiveTab);
  const editor = useVideoDetailStore((s) => s.notesEditor);

  return useCallback(
    (payload: ExcerptPayload) => {
      if (!editor) {
        console.warn("[useExcerpt] editor not ready");
        return;
      }
      setActiveTab("notes");
      // Use a microtask so the tab switch DOM update completes first
      setTimeout(() => {
        editor.commands.focus("end");
        editor.commands.insertContent({
          type: "timeReference",
          attrs: {
            videoTime: payload.videoTime,
            speakerLabel: payload.speakerLabel ?? null,
            excerpt: payload.excerpt,
          },
        });
        // Move cursor below the inserted block so the user can keep typing
        editor.commands.createParagraphNear();

        // Flash animation on the newly inserted block
        requestAnimationFrame(() => {
          const nodes = document.querySelectorAll(
            '[data-type="time-reference"]',
          );
          const last = nodes[nodes.length - 1] as HTMLElement | null;
          if (last) {
            last.classList.add("animate-excerpt-pulse-once");
            setTimeout(
              () => last.classList.remove("animate-excerpt-pulse-once"),
              1500,
            );
          }
        });
      }, 50);
    },
    [editor, setActiveTab],
  );
}
