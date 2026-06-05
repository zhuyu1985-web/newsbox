import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("video detail marker filtering", () => {
  it("stores the marked-only filter state for the transcript tab", () => {
    const source = readProjectFile("components/video-detail/store.ts");

    expect(source).toContain("showMarkedTranscriptOnly");
    expect(source).toContain("setShowMarkedTranscriptOnly");
    expect(source).toContain("selectedTranscriptMarkerKinds");
    expect(source).toContain("toggleTranscriptMarkerKind");
  });

  it("shows a global top-bar filter entry", () => {
    const source = readProjectFile("components/video-detail/VideoDetailLayout.tsx");

    expect(source).toContain("Filter");
    expect(source).toContain("TranscriptMarkerFilterPopover");
    expect(source).toContain("showMarkedTranscriptOnly");
    expect(source).toContain("setActiveTab(\"transcript\")");
    expect(source).not.toContain("只看标记</span>");
  });

  it("lets the top-bar filter popover narrow marked content by marker kind", () => {
    const source = readProjectFile("components/video-detail/TranscriptMarkerFilterPopover.tsx");

    expect(source).toContain("TRANSCRIPT_MARKER_FILTERS");
    expect(source).toContain("selectedTranscriptMarkerKinds");
    expect(source).toContain("toggleTranscriptMarkerKind");
    expect(source).toContain("aria-pressed={selectedTranscriptMarkerKinds.includes(item.kind)}");
    expect(source).toContain("只看标记内容");
  });

  it("removes the duplicate right-panel filter button", () => {
    const source = readProjectFile("components/video-detail/RightPanel/index.tsx");

    expect(source).not.toContain("title=\"筛选\"");
    expect(source).not.toContain("setFilterOpen");
  });

  it("filters the transcript list to marked segments when enabled", () => {
    const source = readProjectFile(
      "components/video-detail/RightPanel/TranscriptPanel.tsx",
    );

    expect(source).toContain("showMarkedTranscriptOnly");
    expect(source).toContain("selectedTranscriptMarkerKinds");
    expect(source).toContain("displaySegments");
    expect(source).toContain("hasTranscriptMarker");
    expect(source).toContain("matchesSelectedMarkerKinds");
  });

  it("keeps marker actions visible for already-marked rows", () => {
    const source = readProjectFile("components/video-detail/shared/MarkerActionBar.tsx");

    expect(source).toContain("hoverOnly && !hasAny");
  });
});
