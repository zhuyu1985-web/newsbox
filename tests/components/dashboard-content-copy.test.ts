import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardContent = readFileSync(
  join(process.cwd(), "components/dashboard/dashboard-content.tsx"),
  "utf8",
);

describe("dashboard note list copy", () => {
  it("does not expose unsupported marker filtering controls", () => {
    expect(dashboardContent).not.toContain("标记筛选：");
    expect(dashboardContent).not.toContain("setMarkerFilter");
  });
});
