import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Timestamp
 * - 行内时间戳：插入「当前正在播放的视频时间点」作为可跳转的 inline 链接
 * - 与 TimeReference（块级带文本摘录）不同，Timestamp 仅渲染 `MM:SS`，不带 excerpt
 * - 点击通过 NotesPanel 的事件委托处理（监听 [data-time-jump]）
 */

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export interface TimestampAttrs {
  time: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    timestamp: {
      insertTimestamp: (time: number) => ReturnType;
    };
  }
}

export const Timestamp = Node.create({
  name: "timestamp",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      time: { default: 0, parseHTML: (el) => Number(el.getAttribute("data-time")) || 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="timestamp"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const time = HTMLAttributes.time as number;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "timestamp",
        "data-time": String(time),
        "data-time-jump": String(time),
        class:
          "inline-flex items-center px-1 mx-0.5 rounded text-xs font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/40 cursor-pointer no-underline",
      }),
      formatTime(time),
    ];
  },

  addCommands() {
    return {
      insertTimestamp:
        (time: number) =>
        ({ chain }) => {
          return chain()
            .focus()
            .insertContent({ type: this.name, attrs: { time } })
            .insertContent(" ")
            .run();
        },
    };
  },
});
