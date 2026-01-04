export type SnapshotTemplate = "business" | "deep" | "social";

export const SNAPSHOT_TEMPLATES: SnapshotTemplate[] = ["business", "deep", "social"];

export function isSnapshotTemplate(x: unknown): x is SnapshotTemplate {
  return x === "business" || x === "deep" || x === "social";
}
