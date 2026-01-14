/**
 * 会员服务模块
 * 提供会员状态计算、权限检查、会员激活等功能
 */

import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// 类型定义
// ============================================================================

export type PlanType = "trial" | "pro" | "ai" | "expired" | "none";

export interface MembershipStatus {
  planType: PlanType;
  isActive: boolean; // 是否有效（未过期）
  canAccessPro: boolean; // 是否可访问 Pro 功能
  canAccessAI: boolean; // 是否可访问 AI 功能
  expiresAt: Date | null;
  daysRemaining: number;
  isTrial: boolean; // 是否在试用期
  isTrialExpired: boolean; // 试用期是否已过期
}

export interface UserMembership {
  user_id: string;
  plan_type: string | null;
  expires_at: string | null;
  trial_started_at: string | null;
  last_payment_at: string | null;
  invite_rewarded_days: number;
  updated_at: string;
}

// ============================================================================
// 常量
// ============================================================================

export const TRIAL_DAYS = 14;

export const PLAN_PRICES: Record<"pro" | "ai", number> = {
  pro: 9.9,
  ai: 19.9,
};

export const PLAN_NAMES: Record<PlanType, string> = {
  trial: "试用会员",
  pro: "NewsBox Pro",
  ai: "NewsBox AI",
  expired: "已过期",
  none: "未订阅",
};

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 计算试用期剩余天数
 */
export function calculateTrialRemaining(
  trialStartedAt: Date | string | null
): number {
  if (!trialStartedAt) return 0;

  const startDate =
    typeof trialStartedAt === "string"
      ? new Date(trialStartedAt)
      : trialStartedAt;
  const now = new Date();
  const trialEndDate = new Date(
    startDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  );

  const remaining = Math.ceil(
    (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.max(0, remaining);
}

/**
 * 计算会员状态
 */
export function calculateMembershipStatus(
  membership: UserMembership | null
): MembershipStatus {
  const now = new Date();

  // 没有会员记录
  if (!membership) {
    return {
      planType: "none",
      isActive: false,
      canAccessPro: false,
      canAccessAI: false,
      expiresAt: null,
      daysRemaining: 0,
      isTrial: false,
      isTrialExpired: true,
    };
  }

  const trialStartedAt = membership.trial_started_at
    ? new Date(membership.trial_started_at)
    : null;
  const expiresAt = membership.expires_at
    ? new Date(membership.expires_at)
    : null;

  // 计算试用期状态
  if (trialStartedAt) {
    const trialEndDate = new Date(
      trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
    );
    const isInTrial = now < trialEndDate;

    if (isInTrial) {
      const daysRemaining = Math.ceil(
        (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      return {
        planType: "trial",
        isActive: true,
        canAccessPro: true,
        canAccessAI: true,
        expiresAt: trialEndDate,
        daysRemaining,
        isTrial: true,
        isTrialExpired: false,
      };
    }
  }

  // 试用期已过，检查付费会员状态
  const isTrialExpired = trialStartedAt !== null;

  // 检查付费会员是否有效
  if (expiresAt && expiresAt > now) {
    const daysRemaining = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const planType = (membership.plan_type as PlanType) || "expired";

    return {
      planType,
      isActive: true,
      canAccessPro: planType === "pro" || planType === "ai",
      canAccessAI: planType === "ai",
      expiresAt,
      daysRemaining,
      isTrial: false,
      isTrialExpired,
    };
  }

  // 会员已过期
  return {
    planType: "expired",
    isActive: false,
    canAccessPro: false,
    canAccessAI: false,
    expiresAt,
    daysRemaining: 0,
    isTrial: false,
    isTrialExpired,
  };
}

/**
 * 获取用户会员状态（服务端调用）
 */
export async function getMembershipStatus(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<MembershipStatus> {
  const supabase = supabaseClient || (await createClient());

  const { data: membership, error } = await supabase
    .from("user_memberships")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[Membership] Failed to get membership:", error);
  }

  return calculateMembershipStatus(membership);
}

/**
 * 获取当前登录用户的会员状态
 */
export async function getCurrentUserMembershipStatus(): Promise<{
  userId: string | null;
  status: MembershipStatus;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      status: {
        planType: "none",
        isActive: false,
        canAccessPro: false,
        canAccessAI: false,
        expiresAt: null,
        daysRemaining: 0,
        isTrial: false,
        isTrialExpired: true,
      },
    };
  }

  const status = await getMembershipStatus(user.id, supabase);
  return { userId: user.id, status };
}

/**
 * 检查用户是否有 AI 功能访问权限
 */
export async function checkAIAccess(userId: string): Promise<boolean> {
  const status = await getMembershipStatus(userId);
  return status.canAccessAI;
}

/**
 * 检查用户是否有 Pro 功能访问权限
 */
export async function checkProAccess(userId: string): Promise<boolean> {
  const status = await getMembershipStatus(userId);
  return status.canAccessPro;
}

/**
 * 激活/续费会员
 */
export async function activateMembership(
  userId: string,
  planType: "pro" | "ai",
  durationDays: number = 365
): Promise<{ success: boolean; error?: string; expiresAt?: Date }> {
  const supabase = await createClient();

  // 获取当前会员状态
  const { data: currentMembership } = await supabase
    .from("user_memberships")
    .select("*")
    .eq("user_id", userId)
    .single();

  // 计算新的到期时间
  let newExpiresAt: Date;
  const now = new Date();

  if (
    currentMembership?.expires_at &&
    new Date(currentMembership.expires_at) > now
  ) {
    // 续费：从当前到期时间延长
    newExpiresAt = new Date(currentMembership.expires_at);
    newExpiresAt.setDate(newExpiresAt.getDate() + durationDays);
  } else {
    // 新订阅：从现在开始
    newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + durationDays);
  }

  // 更新或插入会员记录
  const { error } = await supabase.from("user_memberships").upsert(
    {
      user_id: userId,
      plan_type: planType,
      expires_at: newExpiresAt.toISOString(),
      last_payment_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[Membership] Failed to activate membership:", error);
    return { success: false, error: error.message };
  }

  return { success: true, expiresAt: newExpiresAt };
}

/**
 * 初始化新用户的试用期
 */
export async function initializeTrial(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date();

  const { error } = await supabase.from("user_memberships").upsert(
    {
      user_id: userId,
      plan_type: "trial",
      trial_started_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("[Membership] Failed to initialize trial:", error);
    return false;
  }

  return true;
}

/**
 * 获取原始会员数据（用于调试）
 */
export async function getRawMembershipData(
  userId: string
): Promise<UserMembership | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_memberships")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[Membership] Failed to get raw data:", error);
    return null;
  }

  return data;
}
