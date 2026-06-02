"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE = 1500;
const MAX_RETRY = 3;

export type SaveState = "idle" | "saving" | "saved" | "failed" | "conflict";

export interface ConflictInfo {
  remoteUpdatedAt: string;
  remoteContent: unknown;
}

export function useAutoSave(
  noteId: string,
  editor: Editor | null,
  initialUpdatedAt?: string | null,
) {
  const [state, setState] = useState<SaveState>("idle");
  const [charCount, setCharCount] = useState(0);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const latestJsonRef = useRef<unknown>(null);
  // 我们认为已知的最新版本时间戳（每次成功保存后更新）
  const lastKnownUpdatedAtRef = useRef<string | null>(initialUpdatedAt ?? null);

  const persist = useCallback(
    async (json: unknown, force = false) => {
      setState("saving");
      try {
        const supabase = createClient();

        // 冲突检测：先看远端版本（除非 force=true 走"覆盖"路径）
        if (!force) {
          const { data: latest, error: fetchErr } = await supabase
            .from("notes")
            .select("user_notes_updated_at, user_notes")
            .eq("id", noteId)
            .single();
          if (fetchErr) throw fetchErr;
          const remote = latest?.user_notes_updated_at ?? null;
          const base = lastKnownUpdatedAtRef.current;
          // 远端时间戳比 base 新 → 别人改过
          if (remote && (!base || new Date(remote) > new Date(base))) {
            setConflict({
              remoteUpdatedAt: remote,
              remoteContent: latest?.user_notes ?? null,
            });
            setState("conflict");
            return;
          }
        }

        const now = new Date().toISOString();
        const { error } = await supabase
          .from("notes")
          .update({
            user_notes: json as never,
            user_notes_updated_at: now,
          })
          .eq("id", noteId);
        if (error) throw error;

        lastKnownUpdatedAtRef.current = now;
        setState("saved");
        retryAttemptRef.current = 0;
        // 持久化成功后清掉本地草稿
        try {
          localStorage.removeItem(`video-detail.draft.${noteId}`);
        } catch {}
      } catch {
        const attempt = retryAttemptRef.current++;
        if (attempt < MAX_RETRY) {
          setTimeout(() => persist(json, force), 1000 * Math.pow(2, attempt));
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
      // 处于 conflict 状态时不要把 state 重置为 idle，避免对话框被意外关闭
      setState((prev) => (prev === "conflict" ? prev : "idle"));
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

  // 用户选「覆盖」：把当前本地内容强写到远端
  const resolveOverwrite = useCallback(() => {
    if (!editor) return;
    const json = latestJsonRef.current ?? editor.getJSON();
    setConflict(null);
    persist(json, true);
  }, [editor, persist]);

  // 用户选「重新加载」：把远端内容载入到 editor，丢弃本地修改
  const resolveReload = useCallback(() => {
    if (!editor || !conflict) return;
    const remoteContent = conflict.remoteContent;
    if (remoteContent && typeof remoteContent === "object") {
      // emitUpdate: false 防止 setContent 再次触发 onUpdate → 进入保存循环
      editor.commands.setContent(remoteContent as never, { emitUpdate: false });
    }
    lastKnownUpdatedAtRef.current = conflict.remoteUpdatedAt;
    setConflict(null);
    setState("saved");
    // 本地草稿已与远端同步，可以清理
    try {
      localStorage.removeItem(`video-detail.draft.${noteId}`);
    } catch {}
  }, [editor, conflict, noteId]);

  // 用户选「取消」：保持当前编辑内容，下次保存再触发冲突检测
  const resolveCancel = useCallback(() => {
    setConflict(null);
    setState("idle");
  }, []);

  return {
    state,
    charCount,
    retry,
    conflict,
    resolveOverwrite,
    resolveReload,
    resolveCancel,
  };
}
