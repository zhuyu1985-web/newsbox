import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("video detail marker availability", () => {
  it("tracks marker backend availability in the marker hook", () => {
    const source = readProjectFile("components/video-detail/hooks/useMarkers.ts");

    expect(source).toContain("available");
    expect(source).toContain("markersAvailable");
    expect(source).toContain("usingLocalMarkers");
    expect(source).toContain("createLocalTranscriptMarker");
  });

  it("keeps transcript marker actions visible and lets the hook guard unavailable writes", () => {
    const source = readProjectFile(
      "components/video-detail/RightPanel/TranscriptPanel.tsx",
    );

    expect(source).toContain("<MarkerActionBar");
    expect(source).not.toContain("markersAvailable &&");
  });
});
