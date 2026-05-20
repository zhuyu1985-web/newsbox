import { describe, expect, it } from "vitest";
import {
  estimateTokenCount,
  estimateTokensFromPayload,
} from "@/lib/settings/token-usage";

describe("token usage helpers", () => {
  it("returns zero for empty text", () => {
    expect(estimateTokenCount("   ")).toBe(0);
  });

  it("estimates mixed Chinese and English content", () => {
    expect(estimateTokenCount("这是 NewsBox AI 的 token usage test.")).toBeGreaterThan(5);
  });

  it("walks nested AI payload values", () => {
    const count = estimateTokensFromPayload({
      summary: "核心摘要",
      key_questions: [{ q: "发生了什么？", a: "原文说明了事件经过。" }],
      ignoredNull: null,
    });

    expect(count).toBeGreaterThan(10);
  });
});
