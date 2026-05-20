export type LegacyRightPanelTab = "annotations" | "ai-analysis" | "transcript";

export type RightSidebarTabValue =
  | "transcript"
  | "qa"
  | "visual"
  | "annotations"
  | "ai";

export function mapLegacyTabToRightSidebarTab(
  tab: LegacyRightPanelTab,
  isVideo: boolean
): RightSidebarTabValue {
  if (isVideo) {
    return tab === "transcript" ? "transcript" : "annotations";
  }

  return tab === "ai-analysis" ? "ai" : "annotations";
}

export function mapRightSidebarTabToLegacyTab(
  value: RightSidebarTabValue
): LegacyRightPanelTab {
  if (value === "transcript") return "transcript";
  if (value === "ai") return "ai-analysis";
  return "annotations";
}
