"use client";

/**
 * 升级会员提示对话框
 * 当用户尝试使用受限功能时显示
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useMembership } from "@/components/providers/MembershipProvider";

// ============================================================================
// 类型定义
// ============================================================================

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan?: "pro" | "ai";
  feature?: string;
}

interface UpgradeDialogState {
  open: boolean;
  requiredPlan: "pro" | "ai";
  feature: string;
}

// ============================================================================
// 升级对话框组件
// ============================================================================

export function UpgradeDialog({
  open,
  onOpenChange,
  requiredPlan = "ai",
  feature = "此功能",
}: UpgradeDialogProps) {
  const router = useRouter();
  const { status } = useMembership();

  const planName = requiredPlan === "ai" ? "NewsBox AI" : "NewsBox Pro";
  const planPrice = requiredPlan === "ai" ? "¥19.9" : "¥9.9";

  const handleUpgrade = () => {
    onOpenChange(false);
    router.push("/pricing");
  };

  // 获取当前会员状态描述
  const getCurrentPlanDescription = () => {
    if (!status) return "";

    switch (status.planType) {
      case "trial":
        return `您正在试用期内，剩余 ${status.daysRemaining} 天`;
      case "pro":
        return "您当前是 NewsBox Pro 会员";
      case "expired":
        return "您的会员已过期";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-yellow-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            升级会员
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              <strong>{feature}</strong>需要 <strong>{planName}</strong>{" "}
              会员才能使用。
            </p>
            {getCurrentPlanDescription() && (
              <p className="text-sm text-muted-foreground">
                {getCurrentPlanDescription()}
              </p>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{planName}</span>
            <span className="text-lg font-bold text-primary">
              {planPrice}
              <span className="text-sm font-normal text-muted-foreground">
                /年
              </span>
            </span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {requiredPlan === "ai" ? (
              <>
                <li>✓ AI 智能解读</li>
                <li>✓ 知识库与知识图谱</li>
                <li>✓ 智能专题</li>
                <li>✓ AI 金句提炼</li>
                <li>✓ AI 快照</li>
                <li>✓ 包含 Pro 全部功能</li>
              </>
            ) : (
              <>
                <li>✓ 无限收藏与归档</li>
                <li>✓ 标签管理</li>
                <li>✓ 无广告阅读</li>
                <li>✓ 多端同步</li>
              </>
            )}
          </ul>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            稍后再说
          </Button>
          <Button onClick={handleUpgrade}>立即升级</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// useUpgradeDialog Hook
// ============================================================================

let globalShowUpgradeDialog: ((options: {
  requiredPlan?: "pro" | "ai";
  feature?: string;
}) => void) | null = null;

export function useUpgradeDialog() {
  const [state, setState] = useState<UpgradeDialogState>({
    open: false,
    requiredPlan: "ai",
    feature: "此功能",
  });

  const showUpgradeDialog = useCallback(
    (options: { requiredPlan?: "pro" | "ai"; feature?: string } = {}) => {
      setState({
        open: true,
        requiredPlan: options.requiredPlan || "ai",
        feature: options.feature || "此功能",
      });
    },
    []
  );

  const hideUpgradeDialog = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    upgradeDialogProps: {
      open: state.open,
      onOpenChange: (open: boolean) =>
        setState((prev) => ({ ...prev, open })),
      requiredPlan: state.requiredPlan,
      feature: state.feature,
    },
    showUpgradeDialog,
    hideUpgradeDialog,
  };
}

// ============================================================================
// 全局升级对话框（用于在 Provider 外部调用）
// ============================================================================

export function UpgradeDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { upgradeDialogProps, showUpgradeDialog } = useUpgradeDialog();

  // 注册全局调用方法
  globalShowUpgradeDialog = showUpgradeDialog;

  return (
    <>
      {children}
      <UpgradeDialog {...upgradeDialogProps} />
    </>
  );
}

/**
 * 全局显示升级对话框
 */
export function showUpgradeDialog(options: {
  requiredPlan?: "pro" | "ai";
  feature?: string;
} = {}) {
  if (globalShowUpgradeDialog) {
    globalShowUpgradeDialog(options);
  } else {
    console.warn(
      "[UpgradeDialog] UpgradeDialogProvider not mounted. Redirecting to /pricing."
    );
    window.location.href = "/pricing";
  }
}
