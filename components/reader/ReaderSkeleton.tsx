/**
 * ============================================================================
 * Reader Skeleton Component (阅读器骨架屏组件)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 在阅读页面加载时提供视觉反馈，模拟真实布局以提升用户体验。
 *
 * 设计原则：
 * ---------
 * 1. 布局与真实页面一致（三栏布局）
 * 2. 使用脉冲动画（pulse）模拟加载状态
 * 3. 渐进式显示，避免突兀的内容闪烁
 *
 * @module components/reader/ReaderSkeleton
 */

"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ReaderSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-screen bg-background"
    >
      {/* 顶部导航骨架 */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Logo 区域 */}
          <div className="w-8 h-8 bg-muted rounded-md animate-pulse" />

          {/* 视图切换按钮组 */}
          <div className="flex gap-1 ml-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-20 h-8 bg-muted rounded-md animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 bg-muted rounded-md animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* 进度条骨架 */}
      <div className="h-0.5 bg-muted animate-pulse" />

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧栏骨架 */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="hidden lg:block w-64 border-r border-border bg-muted/20"
        >
          <div className="p-4 space-y-3">
            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="space-y-2"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* 中间内容区骨架 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
            {/* 标题骨架 */}
            <div className="space-y-3">
              <div className="h-10 bg-muted rounded-lg animate-pulse" />
              <div className="h-10 w-4/5 bg-muted rounded-lg animate-pulse" />
            </div>

            {/* 元信息骨架 */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>

            {/* 封面图骨架 */}
            <div className="w-full aspect-video bg-muted rounded-lg animate-pulse" />

            {/* 内容段落骨架 */}
            <div className="space-y-4 pt-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="space-y-2"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-11/12 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 右侧栏骨架 */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="hidden xl:block w-96 border-l border-border bg-muted/20"
        >
          <div className="p-4 space-y-4">
            {/* Tab 切换骨架 */}
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 flex-1 bg-muted rounded-md animate-pulse"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>

            {/* 内容列表骨架 */}
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-3 bg-muted/50 rounded-lg space-y-2"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 加载提示 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-background/95 backdrop-blur-sm border border-border rounded-full shadow-lg"
      >
        <div className="flex items-center gap-3">
          {/* 旋转加载图标 */}
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">正在加载内容...</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * 紧凑版骨架屏（用于快速切换场景）
 */
export function ReaderSkeletonCompact() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 mx-auto border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <div className="text-sm text-muted-foreground animate-pulse">
          加载中...
        </div>
      </div>
    </div>
  );
}
