"use client";
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { baseExtensions } from "../notes/editor-config";
import { NotesToolbar } from "../notes/NotesToolbar";
import { SaveIndicator } from "../notes/SaveIndicator";
import { useAutoSave } from "../hooks/useAutoSave";
import { useVideoSeek } from "../hooks/useVideoSeek";
import { useVideoDetailStore } from "../store";

export function NotesPanel({
  noteId,
  initialContent,
}: {
  noteId: string;
  initialContent: any;
}) {
  const setNotesEditor = useVideoDetailStore((s) => s.setNotesEditor);
  const { seek } = useVideoSeek();

  const handleClickInsideEditor = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const jumpEl = target.closest("[data-time-jump]") as HTMLElement | null;
    if (jumpEl) {
      e.preventDefault();
      e.stopPropagation();
      const t = Number(jumpEl.getAttribute("data-time-jump"));
      if (Number.isFinite(t)) seek(t);
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

  const { state, charCount, retry } = useAutoSave(noteId, editor);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        编辑器加载中…
      </div>
    );
  }

  return (
    <>
      <NotesToolbar editor={editor} />
      <div
        onClick={handleClickInsideEditor}
        className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-track]:bg-transparent"
      >
        <EditorContent editor={editor} />
      </div>
      <SaveIndicator state={state} charCount={charCount} onRetry={retry} />
    </>
  );
}
