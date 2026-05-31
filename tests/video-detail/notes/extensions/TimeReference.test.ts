// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TimeReference } from "@/components/video-detail/notes/extensions/TimeReference";

describe("TimeReference node", () => {
  it("preserves attrs through JSON round-trip", () => {
    const editor = new Editor({
      extensions: [StarterKit, TimeReference],
      content: {
        type: "doc",
        content: [
          {
            type: "timeReference",
            attrs: {
              videoTime: 195,
              speakerLabel: "发言人 1",
              excerpt: "测试摘录",
            },
          },
        ],
      },
    });
    const json = editor.getJSON();
    const node = json.content?.[0] as any;
    expect(node?.type).toBe("timeReference");
    expect(node?.attrs?.videoTime).toBe(195);
    expect(node?.attrs?.speakerLabel).toBe("发言人 1");
    expect(node?.attrs?.excerpt).toBe("测试摘录");
  });

  it("renders with formatted time and excerpt in HTML", () => {
    const editor = new Editor({
      extensions: [StarterKit, TimeReference],
      content: {
        type: "doc",
        content: [
          {
            type: "timeReference",
            attrs: {
              videoTime: 195,
              speakerLabel: "发言人 1",
              excerpt: "hi",
            },
          },
        ],
      },
    });
    const html = editor.getHTML();
    expect(html).toContain("03:15");
    expect(html).toContain("hi");
    expect(html).toContain('data-time="195"');
    expect(html).toContain('data-time-jump="195"');
  });
});
