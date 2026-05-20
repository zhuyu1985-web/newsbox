import { describe, expect, it } from "vitest";
import {
  getMembershipBlockedCopy,
  parseMembershipErrorPayload,
} from "@/lib/membership/client-error";

describe("membership client error handling", () => {
  it("recognizes structured AI membership errors", () => {
    const parsed = parseMembershipErrorPayload({
      code: "membership_required",
      requiredPlan: "ai",
      message: "此功能需要 NewsBox AI 会员",
    });

    expect(parsed).toEqual({
      isMembershipError: true,
      requiredPlan: "ai",
      message: "此功能需要 NewsBox AI 会员",
    });
  });

  it("uses actionable copy for blocked AI reading features", () => {
    expect(
      getMembershipBlockedCopy({
        requiredPlan: "ai",
        feature: "AI 解读",
        message: "此功能需要 NewsBox AI 会员",
      })
    ).toBe("AI 解读需要 NewsBox AI 会员，升级后即可生成文章解读、追问和快照。");
  });
});
