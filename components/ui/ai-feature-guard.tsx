"use client";

/**
 * AI 功能权限守卫组件
 * 包裹 AI 功能组件，自动检查权限并显示升级提示
 */

import { ReactNode } from "react";
import { useAIFeatureGuard } from "@/components/providers/MembershipProvider";
import { showUpgradeDialog } from "@/components/ui/upgrade-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock } from "lucide-react";

interface AIFeatureGuardProps {
  children: ReactNode;
  feature?: string;
  /** 无权限时的显示模式 */
  fallbackMode?: "hide" | "disabled" | "locked" | "inline";
  /** 自定义无权限时的内容 */
  fallback?: ReactNode;
  /** 是否显示 loading 状态 */
  showLoading?: boolean;
}

/**
 * AI 功能守卫组件
 * 用于包裹需要 AI 会员权限的功能
 */
export function AIFeatureGuard({
  children,
  feature = "此功能",
  fallbackMode = "locked",
  fallback,
  showLoading = false,
}: AIFeatureGuardProps) {
  const { canAccessAI, isLoading } = useAIFeatureGuard();

  // 加载中
  if (isLoading && showLoading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg p-4">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
      </div>
    );
  }

  // 有权限，直接显示内容
  if (canAccessAI) {
    return <>{children}</>;
  }

  // 无权限处理
  if (fallback) {
    return <>{fallback}</>;
  }

  switch (fallbackMode) {
    case "hide":
      return null;

    case "disabled":
      return (
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
      );

    case "inline":
      return (
        <button
          onClick={() => showUpgradeDialog({ requiredPlan: "ai", feature })}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>需要 AI 会员</span>
        </button>
      );

    case "locked":
    default:
      return (
        <div className="relative rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-black/80 to-transparent rounded-xl" />
          <div className="relative z-10 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                {feature}需要 AI 会员
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                升级到 NewsBox AI 会员解锁全部 AI 功能
              </p>
            </div>
            <Button
              onClick={() => showUpgradeDialog({ requiredPlan: "ai", feature })}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              升级 AI 会员
            </Button>
          </div>
        </div>
      );
  }
}

/**
 * AI 功能按钮包装器
 * 用于包裹触发 AI 功能的按钮
 */
export function AIFeatureButton({
  children,
  feature = "此功能",
  onClick,
  disabled,
  className,
  ...props
}: {
  children: ReactNode;
  feature?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  [key: string]: any;
}) {
  const { canAccessAI, checkAccess, isLoading } = useAIFeatureGuard();

  const handleClick = () => {
    if (checkAccess(() => showUpgradeDialog({ requiredPlan: "ai", feature }))) {
      onClick?.();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      {...props}
    >
      {children}
      {!canAccessAI && !isLoading && (
        <Lock className="w-3.5 h-3.5 ml-1.5 opacity-60" />
      )}
    </Button>
  );
}

/**
 * 检查 AI 权限的 HOC
 */
export function withAIFeatureGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: { feature?: string; fallbackMode?: AIFeatureGuardProps["fallbackMode"] } = {}
) {
  return function AIGuardedComponent(props: P) {
    return (
      <AIFeatureGuard feature={options.feature} fallbackMode={options.fallbackMode}>
        <WrappedComponent {...props} />
      </AIFeatureGuard>
    );
  };
}
