"use client";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
  Code,
  Clock,
} from "lucide-react";
import { useVideoDetailStore } from "../store";

export function NotesToolbar({ editor }: { editor: Editor | null }) {
  const currentTime = useVideoDetailStore((s) => s.currentTime);
  if (!editor) return null;

  const insertTimestamp = () => {
    const t = Math.floor(currentTime);
    editor.chain().focus().insertTimestamp(t).run();
  };

  const Btn = ({
    active,
    onClick,
    title,
    children,
    disabled,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={
        active
          ? "w-7 h-7 rounded bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center"
          : "w-7 h-7 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-muted-foreground disabled:opacity-30 flex items-center justify-center"
      }
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-4 bg-border mx-1" />;

  return (
    <div className="border-b border-border/50 px-3 py-2 flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={insertTimestamp}
        title={`插入当前播放时间点 (${Math.floor(currentTime / 60)
          .toString()
          .padStart(2, "0")}:${(Math.floor(currentTime) % 60)
          .toString()
          .padStart(2, "0")})`}
        className="h-7 px-1.5 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs"
      >
        <Clock size={13} />
        <span>时间点</span>
      </button>
      <Divider />
      <Btn
        title="撤销"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo size={14} />
      </Btn>
      <Btn
        title="重做"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo size={14} />
      </Btn>
      <Divider />
      <Btn
        title="标题"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </Btn>
      <Btn
        title="加粗"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </Btn>
      <Btn
        title="斜体"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </Btn>
      <Btn
        title="下划线"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </Btn>
      <Btn
        title="高亮"
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter size={14} />
      </Btn>
      <Btn
        title="行内代码"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={14} />
      </Btn>
      <Divider />
      <Btn
        title="无序列表"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </Btn>
      <Btn
        title="有序列表"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </Btn>
    </div>
  );
}
