import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { TimeReference } from "./extensions/TimeReference";
import { KeyframeReference } from "./extensions/KeyframeReference";
import { AnnotationReference } from "./extensions/AnnotationReference";

// Base extension set. Phase 7 will append TimeReference / KeyframeReference
// custom nodes to this list — keep the structure flexible (array of extensions).
export const baseExtensions = [
  StarterKit,
  Underline,
  Highlight.configure({
    HTMLAttributes: { class: "bg-yellow-200 dark:bg-yellow-900/70 rounded px-0.5" },
  }),
  TextStyle,
  Color,
  Image,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: "在这里记录你的想法吧，可以插入图片和表格哦…" }),
  CharacterCount,
  TimeReference,
  KeyframeReference,
  AnnotationReference,
];
