"use client";
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Content } from "@tiptap/core";
import { Sparkles } from "lucide-react";
import { baseExtensions } from "../notes/editor-config";
import { NotesToolbar } from "../notes/NotesToolbar";
import { SaveIndicator } from "../notes/SaveIndicator";
import { ConflictDialog } from "../notes/ConflictDialog";
import { AIRewriteDialog } from "../AIRewriteDialog";
import { useAutoSave } from "../hooks/useAutoSave";
import { useVideoSeek } from "../hooks/useVideoSeek";
import { useVideoDetailStore } from "../store";

export function NotesPanel({
  noteId,
  initialContent,
  initialUpdatedAt,
}: {
  noteId: string;
  initialContent: Content;
  initialUpdatedAt?: string | null;
}) {
  const setNotesEditor = useVideoDetailStore((s) => s.setNotesEditor);
  const { seekAndPlay } = useVideoSeek();
  const [rewriteOpen, setRewriteOpen] = useState(false);

  const handleClickInsideEditor = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const jumpEl = target.closest("[data-time-jump]") as HTMLElement | null;
    if (jumpEl) {
      e.preventDefault();
      e.stopPropagation();
      const t = Number(jumpEl.getAttribute("data-time-jump"));
      if (Number.isFinite(t)) seekAndPlay(t);
    }
  };

  const editor = useEditor({
    extensions: baseExtensions,
    content: initialContent ?? "",
    autofocus: false,
    immediatelyRender: false, // SSR-safe (Next.js App Router)
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none [&_.ProseMirror]:outline-none min-h-[200px]",
      },
    },
  });

  useEffect(() => {
    if (editor) setNotesEditor(editor);
    return () => setNotesEditor(null);
  }, [editor, setNotesEditor]);

  const {
    state,
    charCount,
    retry,
    conflict,
    resolveOverwrite,
    resolveReload,
    resolveCancel,
  } = useAutoSave(noteId, editor, initialUpdatedAt);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        编辑器加载中…
      </div>
    );
  }

  return (
    <>
      <NotesToolbar editor={editor} />
      <div className="flex-1 relative overflow-hidden">
        <div
          onClick={handleClickInsideEditor}
          className="absolute inset-0 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-foreground [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/15 dark:[&::-webkit-scrollbar-thumb]:bg-slate-200/10 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300/25 dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-200/18 [&::-webkit-scrollbar-thumb]:backdrop-blur-md [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:transition-colors"
        >
          <EditorContent editor={editor} />
        </div>
        <button
          onClick={() => setRewriteOpen(true)}
          className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-blue-600 dark:bg-blue-500 text-white shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center z-10"
          title="AI 改写"
        >
          <Sparkles size={14} />
        </button>
      </div>
      <SaveIndicator
        state={state === "conflict" ? "failed" : state}
        charCount={charCount}
        onRetry={retry}
      />
      <ConflictDialog
        open={state === "conflict"}
        remoteUpdatedAt={conflict?.remoteUpdatedAt ?? null}
        onOverwrite={resolveOverwrite}
        onReload={resolveReload}
        onCancel={resolveCancel}
      />
      <AIRewriteDialog
        open={rewriteOpen}
        onOpenChange={setRewriteOpen}
        editor={editor}
      />
    </>
  );
}
