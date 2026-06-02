import { Node, mergeAttributes } from "@tiptap/core";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export const KeyframeReference = Node.create({
  name: "keyframeReference",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      timestamp: { default: 0 },
      imageUrl: { default: "" },
      sceneDescription: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="keyframe-reference"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const time = HTMLAttributes.timestamp as number;
    const imageUrl = HTMLAttributes.imageUrl as string;
    const desc = (HTMLAttributes.sceneDescription as string) || "";
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-type": "keyframe-reference",
        "data-time": String(time),
        class:
          "my-3 inline-block border border-border/60 rounded-lg overflow-hidden cursor-pointer max-w-xs hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700 transition",
      }),
      [
        "img",
        {
          src: imageUrl,
          referrerpolicy: "no-referrer",
          class: "w-full h-auto block",
          "data-time-jump": String(time),
        },
      ],
      [
        "figcaption",
        {
          class:
            "px-2 py-1 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/40",
        },
        ["span", { class: "truncate" }, desc || "关键帧"],
        [
          "span",
          {
            class:
              "font-mono cursor-pointer hover:underline shrink-0 ml-2 text-blue-600 dark:text-blue-400",
            "data-time-jump": String(time),
          },
          formatTime(time),
        ],
      ],
    ];
  },
});
