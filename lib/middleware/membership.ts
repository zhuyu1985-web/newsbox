/**
 * 会员权限检查中间件
 * 用于 API 路由中验证用户会员权限
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembershipStatus, MembershipStatus } from "@/lib/services/membership";

// ============================================================================
// 类型定义
// ============================================================================

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  membershipStatus?: MembershipStatus;
}

export interface PermissionCheckResult {
  authorized: boolean;
  userId?: string;
  membershipStatus?: MembershipStatus;
  response?: NextResponse;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取当前用户和会员状态
 */
async function getCurrentUserAndMembership(): Promise<{
  userId: string | null;
  status: MembershipStatus | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { userId: null, status: null, error: "Unauthorized" };
    }

    const status = await getMembershipStatus(user.id, supabase);
    return { userId: user.id, status };
  } catch (error) {
    console.error("[Membership Middleware] Error:", error);
    return { userId: null, status: null, error: "Internal error" };
  }
}

// ============================================================================
// 权限检查函数
// ============================================================================

/**
 * 要求用户登录
 */
export async function requireAuth(): Promise<PermissionCheckResult> {
  const { userId, status, error } = await getCurrentUserAndMembership();

  if (!userId || !status) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized", message: "请先登录" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    userId,
    membershipStatus: status,
  };
}

/**
 * 要求 Pro 或更高会员权限
 */
export async function requireProMembership(): Promise<PermissionCheckResult> {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const status = authResult.membershipStatus!;

  if (!status.canAccessPro) {
    return {
      authorized: false,
      userId: authResult.userId,
      membershipStatus: status,
      response: NextResponse.json(
        {
          error: "PRO_MEMBERSHIP_REQUIRED",
          message: "此功能需要 NewsBox Pro 会员",
          code: "membership_required",
          requiredPlan: "pro",
        },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * 要求 AI 会员权限
 */
export async function requireAIMembership(): Promise<PermissionCheckResult> {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const status = authResult.membershipStatus!;

  if (!status.canAccessAI) {
    return {
      authorized: false,
      userId: authResult.userId,
      membershipStatus: status,
      response: NextResponse.json(
        {
          error: "AI_MEMBERSHIP_REQUIRED",
          message: "此功能需要 NewsBox AI 会员",
          code: "membership_required",
          requiredPlan: "ai",
        },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * 要求有效会员（Pro 或 AI，试用期内也可以）
 */
export async function requireActiveMembership(): Promise<PermissionCheckResult> {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult;
  }

  const status = authResult.membershipStatus!;

  if (!status.isActive) {
    return {
      authorized: false,
      userId: authResult.userId,
      membershipStatus: status,
      response: NextResponse.json(
        {
          error: "MEMBERSHIP_EXPIRED",
          message: "您的会员已过期，请续费后继续使用",
          code: "membership_expired",
        },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

// ============================================================================
// 高阶函数包装器
// ============================================================================

/**
 * 包装 API handler，添加 Pro 权限检查
 */
export function withProMembership<T>(
  handler: (
    req: NextRequest,
    context: { userId: string; membershipStatus: MembershipStatus }
  ) => Promise<T>
) {
  return async (req: NextRequest): Promise<T | NextResponse> => {
    const check = await requireProMembership();
    if (!check.authorized) {
      return check.response!;
    }
    return handler(req, {
      userId: check.userId!,
      membershipStatus: check.membershipStatus!,
    });
  };
}

/**
 * 包装 API handler，添加 AI 权限检查
 */
export function withAIMembership<T>(
  handler: (
    req: NextRequest,
    context: { userId: string; membershipStatus: MembershipStatus }
  ) => Promise<T>
) {
  return async (req: NextRequest): Promise<T | NextResponse> => {
    const check = await requireAIMembership();
    if (!check.authorized) {
      return check.response!;
    }
    return handler(req, {
      userId: check.userId!,
      membershipStatus: check.membershipStatus!,
    });
  };
}

/**
 * 包装 API handler，添加有效会员检查
 */
export function withActiveMembership<T>(
  handler: (
    req: NextRequest,
    context: { userId: string; membershipStatus: MembershipStatus }
  ) => Promise<T>
) {
  return async (req: NextRequest): Promise<T | NextResponse> => {
    const check = await requireActiveMembership();
    if (!check.authorized) {
      return check.response!;
    }
    return handler(req, {
      userId: check.userId!,
      membershipStatus: check.membershipStatus!,
    });
  };
}
