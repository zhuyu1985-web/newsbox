import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("video detail analysis UI", () => {
  it("refreshes the reader content when analysis reaches a terminal complete state", () => {
    const source = readProjectFile("components/video-detail/AnalysisProgress.tsx");

    expect(source).toContain("reader:refresh-content");
    expect(source).toContain("refreshDispatchedRef");
  });

  it("uses an animated analysis-in-progress chip", () => {
    const source = readProjectFile("components/video-detail/AnalysisProgress.tsx");

    expect(source).toContain("animate-analysis-glow");
    expect(source).toContain("animate-analysis-shimmer");
  });

  it("uses lighter, more transparent video detail scrollbars", () => {
    const files = [
      "components/video-detail/MainStage/index.tsx",
      "components/video-detail/RightPanel/BriefPanel.tsx",
      "components/video-detail/RightPanel/NotesPanel.tsx",
      "components/video-detail/RightPanel/TranscriptPanel.tsx",
    ];

    for (const file of files) {
      const source = readProjectFile(file);
      expect(source).toContain("bg-slate-300/15");
      expect(source).not.toContain("bg-blue-400/30");
      expect(source).not.toContain("bg-blue-500/45");
    }
  });
});
