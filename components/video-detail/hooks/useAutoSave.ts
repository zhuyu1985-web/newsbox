"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE = 1500;
const MAX_RETRY = 3;

export type SaveState = "idle" | "saving" | "saved" | "failed";

export function useAutoSave(noteId: string, editor: Editor | null) {
  const [state, setState] = useState<SaveState>("idle");
  const [charCount, setCharCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const latestJsonRef = useRef<any>(null);

  const persist = useCallback(
    async (json: any) => {
      setState("saving");
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("notes")
          .update({
            user_notes: json,
            user_notes_updated_at: new Date().toISOString(),
          })
          .eq("id", noteId);
        if (error) throw error;
        setState("saved");
        retryAttemptRef.current = 0;
        // 持久化成功后清掉本地草稿
        try {
          localStorage.removeItem(`video-detail.draft.${noteId}`);
        } catch {}
      } catch {
        const attempt = retryAttemptRef.current++;
        if (attempt < MAX_RETRY) {
          setTimeout(
            () => persist(json),
            1000 * Math.pow(2, attempt),
          );
        } else {
          setState("failed");
        }
      }
    },
    [noteId],
  );

  // 监听编辑器内容变化
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      const json = editor.getJSON();
      latestJsonRef.current = json;
      setCharCount(editor.storage.characterCount?.characters() ?? 0);
      setState("idle");
      // localStorage 草稿（防 crash 丢内容）
      try {
        localStorage.setItem(
          `video-detail.draft.${noteId}`,
          JSON.stringify(json),
        );
      } catch {}
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => persist(json), DEBOUNCE);
    };
    editor.on("update", onUpdate);
    setCharCount(editor.storage.characterCount?.characters() ?? 0);
    return () => {
      editor.off("update", onUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, noteId, persist]);

  const retry = useCallback(() => {
    if (!editor) return;
    const json = latestJsonRef.current ?? editor.getJSON();
    retryAttemptRef.current = 0;
    persist(json);
  }, [editor, persist]);

  return { state, charCount, retry };
}
