"use client";

import { Crown, Sparkles, Zap } from "lucide-react";
import { useMembership } from "@/components/providers/MembershipProvider";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MembershipBadgeProps {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/**
 * 会员身份徽章组件
 * 根据用户会员等级显示不同的徽章样式
 */
export function MembershipBadge({
  size = "md",
  showLabel = true,
  className,
}: MembershipBadgeProps) {
  const { status, isLoading } = useMembership();

  if (isLoading || !status) {
    return null;
  }

  // 未激活会员不显示徽章
  if (!status.isActive && status.planType !== "trial") {
    return null;
  }

  const sizeClasses = {
    sm: "h-5 text-[10px] px-1.5 gap-0.5",
    md: "h-6 text-xs px-2 gap-1",
    lg: "h-8 text-sm px-3 gap-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  // 根据会员类型返回不同的配置
  const getBadgeConfig = () => {
    switch (status.planType) {
      case "ai":
        return {
          label: "AI",
          icon: Sparkles,
          gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
          textColor: "text-white",
          shadow: "shadow-purple-500/30",
          borderColor: "border-purple-400/50",
          bgGlow: "bg-purple-500/20",
        };
      case "pro":
        return {
          label: "Pro",
          icon: Crown,
          gradient: "from-amber-400 via-orange-400 to-yellow-500",
          textColor: "text-white",
          shadow: "shadow-amber-500/30",
          borderColor: "border-amber-400/50",
          bgGlow: "bg-amber-500/20",
        };
      case "trial":
        return {
          label: `试用 ${status.daysRemaining}天`,
          icon: Zap,
          gradient: "from-blue-400 via-cyan-400 to-teal-400",
          textColor: "text-white",
          shadow: "shadow-blue-500/20",
          borderColor: "border-blue-400/50",
          bgGlow: "bg-blue-500/10",
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Link href="/pricing" className="block">
      <div
        className={cn(
          "inline-flex items-center rounded-full font-bold",
          "bg-gradient-to-r",
          config.gradient,
          config.textColor,
          "shadow-lg",
          config.shadow,
          "border",
          config.borderColor,
          "transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer",
          "relative overflow-hidden",
          sizeClasses[size],
          className
        )}
      >
        {/* 闪光效果 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
        
        <Icon className={cn(iconSizes[size], "relative z-10")} />
        {showLabel && (
          <span className="relative z-10 font-semibold tracking-wide">
            {config.label}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * 简洁的会员状态指示器（用于侧边栏）
 */
export function MembershipIndicator({ className }: { className?: string }) {
  const { status, isLoading } = useMembership();

  if (isLoading || !status) {
    return null;
  }

  const getIndicatorConfig = () => {
    switch (status.planType) {
      case "ai":
        return {
          color: "bg-gradient-to-r from-violet-500 to-purple-500",
          icon: Sparkles,
          tooltip: "NewsBox AI 会员",
        };
      case "pro":
        return {
          color: "bg-gradient-to-r from-amber-400 to-orange-500",
          icon: Crown,
          tooltip: "NewsBox Pro 会员",
        };
      case "trial":
        return {
          color: "bg-gradient-to-r from-blue-400 to-cyan-500",
          icon: Zap,
          tooltip: `试用期剩余 ${status.daysRemaining} 天`,
        };
      default:
        return null;
    }
  };

  const config = getIndicatorConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Link
      href="/pricing"
      className={cn(
        "w-[46px] h-[46px] rounded-[15px] flex items-center justify-center",
        "transition-all duration-300 hover:scale-105 group relative",
        className
      )}
      title={config.tooltip}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          config.color,
          "shadow-lg transition-shadow group-hover:shadow-xl"
        )}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      
      {/* 会员光晕效果 */}
      <div
        className={cn(
          "absolute inset-0 rounded-[15px] opacity-0 group-hover:opacity-100",
          "transition-opacity duration-300",
          config.color,
          "blur-xl -z-10"
        )}
        style={{ transform: "scale(0.8)" }}
      />
    </Link>
  );
}
