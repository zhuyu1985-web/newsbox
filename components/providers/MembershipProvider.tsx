"use client";

/**
 * 会员状态上下文
 * 提供全局会员状态管理和权限检查功能
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// 类型定义
// ============================================================================

export type PlanType = "trial" | "pro" | "ai" | "expired" | "none";

export interface MembershipStatus {
  planType: PlanType;
  planName: string;
  isActive: boolean;
  canAccessPro: boolean;
  canAccessAI: boolean;
  expiresAt: string | null;
  daysRemaining: number;
  isTrial: boolean;
  isTrialExpired: boolean;
}

interface MembershipContextValue {
  status: MembershipStatus | null;
  isLoading: boolean;
  error: string | null;
  refreshMembership: () => Promise<void>;
}

// ============================================================================
// 默认值
// ============================================================================

const defaultStatus: MembershipStatus = {
  planType: "none",
  planName: "未订阅",
  isActive: false,
  canAccessPro: false,
  canAccessAI: false,
  expiresAt: null,
  daysRemaining: 0,
  isTrial: false,
  isTrialExpired: true,
};

const MembershipContext = createContext<MembershipContextValue>({
  status: null,
  isLoading: true,
  error: null,
  refreshMembership: async () => {},
});

// ============================================================================
// Provider
// ============================================================================

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembershipStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus(defaultStatus);
        return;
      }

      const response = await fetch("/api/membership/status");
      if (!response.ok) {
        throw new Error("获取会员状态失败");
      }

      const result = await response.json();
      if (result.success && result.data) {
        setStatus(result.data);
      } else {
        setStatus(defaultStatus);
      }
    } catch (err) {
      console.error("[MembershipProvider] Error:", err);
      setError(err instanceof Error ? err.message : "未知错误");
      setStatus(defaultStatus);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化时获取会员状态
  useEffect(() => {
    fetchMembershipStatus();
  }, [fetchMembershipStatus]);

  // 监听登录状态变化
  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchMembershipStatus();
      } else if (event === "SIGNED_OUT") {
        setStatus(defaultStatus);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchMembershipStatus]);

  return (
    <MembershipContext.Provider
      value={{
        status,
        isLoading,
        error,
        refreshMembership: fetchMembershipStatus,
      }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取会员状态
 */
export function useMembership() {
  const context = useContext(MembershipContext);
  if (!context) {
    throw new Error("useMembership must be used within MembershipProvider");
  }
  return context;
}

/**
 * AI 功能权限检查 Hook
 */
export function useAIFeatureGuard() {
  const { status, isLoading } = useMembership();

  const canAccessAI = status?.canAccessAI ?? false;

  const checkAccess = useCallback(
    (onBlocked?: () => void): boolean => {
      if (isLoading) return false;

      if (!canAccessAI) {
        onBlocked?.();
        return false;
      }

      return true;
    },
    [canAccessAI, isLoading]
  );

  return {
    canAccessAI,
    isLoading,
    checkAccess,
    planType: status?.planType ?? "none",
  };
}

/**
 * Pro 功能权限检查 Hook
 */
export function useProFeatureGuard() {
  const { status, isLoading } = useMembership();

  const canAccessPro = status?.canAccessPro ?? false;

  const checkAccess = useCallback(
    (onBlocked?: () => void): boolean => {
      if (isLoading) return false;

      if (!canAccessPro) {
        onBlocked?.();
        return false;
      }

      return true;
    },
    [canAccessPro, isLoading]
  );

  return {
    canAccessPro,
    isLoading,
    checkAccess,
    planType: status?.planType ?? "none",
  };
}

/**
 * 检查会员是否有效（未过期）
 */
export function useActiveMembership() {
  const { status, isLoading } = useMembership();

  return {
    isActive: status?.isActive ?? false,
    isLoading,
    isTrial: status?.isTrial ?? false,
    isTrialExpired: status?.isTrialExpired ?? true,
    daysRemaining: status?.daysRemaining ?? 0,
    planType: status?.planType ?? "none",
    planName: status?.planName ?? "未订阅",
  };
}
