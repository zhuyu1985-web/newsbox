import { describe, expect, it } from "vitest";
import {
  buildArticleSidebarModel,
  extractHeadings,
} from "@/lib/reader/article-outline";

describe("article outline sidebar model", () => {
  it("uses real headings when at least two headings are available", () => {
    const model = buildArticleSidebarModel({
      noteId: "note-a",
      contentHtml: `
        <h1>第一部分：事件背景</h1>
        <p>正文内容</p>
        <h2>第二部分：各方回应</h2>
      `,
    });

    expect(model.mode).toBe("outline");
    expect(model.outline).toEqual([
      {
        id: "heading-0",
        level: 1,
        text: "第一部分：事件背景",
        sourceIndex: 0,
      },
      {
        id: "heading-1",
        level: 2,
        text: "第二部分：各方回应",
        sourceIndex: 1,
      },
    ]);
  });

  it("deduplicates and trims extracted headings", () => {
    expect(
      extractHeadings(`
        <h2>  <span>核心观点</span> </h2>
        <h3>核心观点</h3>
        <h3>后续影响</h3>
      `)
    ).toEqual([
      {
        id: "heading-0",
        level: 2,
        text: "核心观点",
        sourceIndex: 0,
      },
      {
        id: "heading-2",
        level: 3,
        text: "后续影响",
        sourceIndex: 2,
      },
    ]);
  });

  it("falls back to article-derived clue cards when headings are sparse", () => {
    const model = buildArticleSidebarModel({
      noteId: "note-b",
      title: "某公司发布新产品，市场关注后续影响",
      excerpt: "这家公司在发布会上公布了新的产品路线，并表示会在未来几个月逐步开放测试。",
      siteName: "NewsBox Daily",
      publishedAt: "2026-05-21T08:00:00.000Z",
      contentHtml: `
        <p>这家公司在发布会上公布了新的产品路线，并表示会在未来几个月逐步开放测试。</p>
        <p>分析人士认为，这一变化可能影响既有市场格局，但是具体效果仍取决于用户反馈。</p>
      `,
    });

    expect(model.mode).toBe("clues");
    expect(model.cards).toHaveLength(3);
    expect(model.cards.map((card) => card.sourceLabel)).toContain("来自当前文章");
    expect(model.cards.map((card) => card.kind)).toContain("question");
  });

  it("uses deterministic local inspiration cards when article data is too sparse", () => {
    const first = buildArticleSidebarModel({
      noteId: "note-c",
      title: "短讯",
      contentHtml: "<p>太短</p>",
      date: new Date(2026, 4, 21, 8),
    });
    const second = buildArticleSidebarModel({
      noteId: "note-c",
      title: "短讯",
      contentHtml: "<p>太短</p>",
      date: new Date(2026, 4, 21, 20),
    });

    expect(first.mode).toBe("inspiration");
    expect(first.cards).toHaveLength(3);
    expect(first.cards).toEqual(second.cards);
    expect(first.cards.every((card) => card.sourceLabel === "本地灵感库")).toBe(true);
  });
});
