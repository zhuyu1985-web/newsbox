import { describe, expect, it } from "vitest";
import {
  mapLegacyTabToRightSidebarTab,
  mapRightSidebarTabToLegacyTab,
} from "@/lib/reader/right-sidebar-tabs";

describe("right sidebar tab mapping", () => {
  it("maps the legacy AI analysis tab to the visible AI tab for articles", () => {
    expect(mapLegacyTabToRightSidebarTab("ai-analysis", false)).toBe("ai");
  });

  it("falls back to annotations when AI analysis is requested for videos", () => {
    expect(mapLegacyTabToRightSidebarTab("ai-analysis", true)).toBe("annotations");
  });

  it("maps visible AI tab changes back to the legacy parent state", () => {
    expect(mapRightSidebarTabToLegacyTab("ai")).toBe("ai-analysis");
    expect(mapRightSidebarTabToLegacyTab("annotations")).toBe("annotations");
    expect(mapRightSidebarTabToLegacyTab("transcript")).toBe("transcript");
  });
});
