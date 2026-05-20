export type RequiredMembershipPlan = "pro" | "ai";

export interface MembershipErrorPayload {
  isMembershipError: true;
  requiredPlan: RequiredMembershipPlan;
  message: string;
}

function isRequiredPlan(value: unknown): value is RequiredMembershipPlan {
  return value === "pro" || value === "ai";
}

export function parseMembershipErrorPayload(
  payload: unknown
): MembershipErrorPayload | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const code = String(record.code || "");
  const error = String(record.error || "");
  const requiredPlan = record.requiredPlan;

  const isMembershipError =
    code === "membership_required" ||
    code === "membership_expired" ||
    error.includes("MEMBERSHIP");

  if (!isMembershipError || !isRequiredPlan(requiredPlan)) {
    return null;
  }

  return {
    isMembershipError: true,
    requiredPlan,
    message: String(record.message || "此功能需要会员权限"),
  };
}

export function getMembershipBlockedCopy({
  requiredPlan,
  feature,
}: {
  requiredPlan: RequiredMembershipPlan;
  feature: string;
  message?: string;
}): string {
  if (requiredPlan === "ai") {
    return `${feature}需要 NewsBox AI 会员，升级后即可生成文章解读、追问和快照。`;
  }

  return `${feature}需要 NewsBox Pro 会员，升级后即可继续使用。`;
}
