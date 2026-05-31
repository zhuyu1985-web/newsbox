import { Node, mergeAttributes } from "@tiptap/core";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export interface TimeReferenceAttrs {
  videoTime: number;
  speakerLabel: string | null;
  excerpt: string;
}

export const TimeReference = Node.create({
  name: "timeReference",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      videoTime: { default: 0 },
      speakerLabel: { default: null },
      excerpt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="time-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const time = HTMLAttributes.videoTime as number;
    const speaker = HTMLAttributes.speakerLabel as string | null;
    const excerpt = HTMLAttributes.excerpt as string;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "time-reference",
        "data-time": String(time),
        class:
          "my-3 border-l-4 border-violet-400 dark:border-violet-500 bg-violet-50/70 dark:bg-violet-950/40 pl-3 pr-2 py-2 rounded-r",
      }),
      [
        "div",
        {
          class:
            "flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-300 mb-1",
        },
        [
          "span",
          {
            class: "font-mono font-medium cursor-pointer hover:underline",
            "data-time-jump": String(time),
          },
          formatTime(time),
        ],
        speaker
          ? [
              "span",
              { class: "text-slate-400 dark:text-slate-500" },
              `· ${speaker}`,
            ]
          : "",
      ],
      [
        "p",
        {
          class: "text-xs text-slate-700 dark:text-slate-300 italic",
        },
        `"${excerpt}"`,
      ],
    ];
  },
});
