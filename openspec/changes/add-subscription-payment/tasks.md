# Tasks: Add Subscription Payment System

## 1. Database Schema

- [x] 1.1 创建迁移文件 `supabase/migrations/021_add_subscription_payment.sql`
- [x] 1.2 扩展 `user_memberships` 表添加字段：
  - `plan_type TEXT DEFAULT 'trial'` (试用/pro/ai/expired)
  - `trial_started_at TIMESTAMPTZ` (试用开始时间)
  - `last_payment_at TIMESTAMPTZ` (最后支付时间)
- [x] 1.3 创建 `subscription_orders` 表存储订单信息
- [x] 1.4 创建 `user_notifications` 表（如不存在）用于通知推送
- [x] 1.5 添加 RLS 策略确保用户只能访问自己的数据
- [x] 1.6 为现有用户初始化 `trial_started_at` 为 `created_at`

## 2. Backend - Membership Service

- [x] 2.1 创建 `lib/services/membership.ts` 会员服务
  - `getMembershipStatus(userId)` 获取会员状态
  - `calculateTrialRemaining(trialStartedAt)` 计算试用剩余天数
  - `activateMembership(userId, planType, expiresAt)` 激活会员
  - `checkAIAccess(userId)` 检查 AI 功能访问权限
- [x] 2.2 创建 `app/api/membership/status/route.ts` 获取当前用户会员状态
- [x] 2.3 测试会员状态 API 返回正确的权限信息

## 3. Backend - Payment Integration

- [x] 3.1 创建 `lib/services/zpay.ts` z-pay 支付工具库
  - `generateSign(params, key)` 生成签名
  - `verifySign(params, sign, key)` 验证签名
  - `generatePaymentUrl(order)` 生成支付链接
- [x] 3.2 添加环境变量 `ZPAY_PID` 和 `ZPAY_KEY`
- [x] 3.3 创建 `app/api/payment/create/route.ts` 创建订单并返回支付链接
  - 验证用户登录
  - 生成唯一订单号
  - 保存订单到数据库
  - 返回 z-pay 支付 URL
- [x] 3.4 创建 `app/api/payment/notify/route.ts` 处理 z-pay 异步回调
  - 验证签名
  - 检查订单状态（幂等处理）
  - 更新订单状态为 paid
  - 激活/延长用户会员
  - 返回 "success"
- [x] 3.5 创建 `app/api/payment/return/route.ts` 处理支付后页面跳转
  - 验证签名
  - 重定向到 /dashboard 并显示成功提示
- [x] 3.6 测试支付流程（使用沙箱或小额测试）

## 4. Backend - Permission Middleware

- [x] 4.1 创建 `lib/middleware/membership.ts` 权限检查中间件
  - `requireProMembership` 要求 Pro 或更高权限
  - `requireAIMembership` 要求 AI 权限
- [x] 4.2 在 AI 相关 API 路由添加权限检查：
  - `/api/ai/summary/*`
  - `/api/ai/snapshot/*`
  - `/api/knowledge/*`
  - `/api/quote-materials/extract`
- [x] 4.3 测试权限检查返回正确的 403 响应

## 5. Frontend - Membership Context

- [x] 5.1 创建 `components/providers/MembershipProvider.tsx`
  - 提供 `useMembership()` Hook
  - 登录后自动加载会员状态
  - 提供 `refreshMembership()` 方法
- [x] 5.2 在 `app/providers.tsx` 中添加 MembershipProvider
- [x] 5.3 创建 `components/ui/upgrade-dialog.tsx` 升级提示对话框
  - 显示当前会员状态
  - 显示升级按钮跳转 /pricing
- [x] 5.4 创建 `hooks/useAIFeatureGuard.ts` AI 功能权限检查 Hook

## 6. Frontend - Login Interception

- [x] 6.1 修改 `components/dashboard/dashboard-auth-check.tsx`
  - 检查会员状态
  - 试用过期且未付费 → 重定向到 /pricing
  - 会员过期 → 重定向到 /pricing
- [x] 6.2 创建试用过期提示页面组件
- [x] 6.3 测试登录拦截逻辑

## 7. Frontend - Pricing Page

- [x] 7.1 更新 `app/pricing/page.tsx` 价格信息
  - NewsBox Pro: ¥9.9/年
  - NewsBox AI: ¥19.9/年
- [x] 7.2 添加支付按钮调用支付接口
  - 已登录用户：发起支付
  - 未登录用户：跳转注册页面
- [x] 7.3 添加支付方式选择（支付宝/微信）
- [x] 7.4 添加支付中状态和结果展示
- [x] 7.5 测试支付流程完整性

## 8. Frontend - AI Feature Guards

- [x] 8.1 创建 `components/ui/ai-feature-guard.tsx` AI 功能权限守卫组件
  - AIFeatureGuard 包装组件
  - AIFeatureButton 按钮包装器
  - withAIFeatureGuard HOC
- [x] 8.2 在知识库组件可使用权限检查
  - `components/dashboard/knowledge-graph/*`
  - `components/dashboard/smart-topics/*`
- [x] 8.3 在金句提取功能可使用权限检查
- [x] 8.4 在 AI 快照功能可使用权限检查
- [x] 8.5 后端 API 已添加权限检查中间件

## 9. Expiration Notification

- [x] 9.1 创建 `supabase/functions/membership-expiry-check/index.ts` Edge Function
  - 查找 7 天内到期的用户
  - 查找 3 天内到期的用户
  - 插入通知记录（避免重复）
- [x] 9.2 配置定时任务每天运行一次
- [x] 9.3 在 Dashboard 通知组件显示会员到期提醒
  - 修改 `components/dashboard/NotificationsPopover.tsx`
- [x] 9.4 测试通知显示和已读状态

## 10. End-to-End Testing

- [x] 10.1 测试新用户注册 → 14 天试用 → 过期拦截流程
- [x] 10.2 测试 Pro 订阅 → 支付 → 开通 → 使用流程
- [x] 10.3 测试 AI 订阅 → 支付 → 开通 → AI 功能可用
- [x] 10.4 测试 Pro 用户访问 AI 功能 → 升级提示
- [x] 10.5 测试会员到期 → 通知 → 过期拦截流程
- [x] 10.6 测试支付回调异常恢复

## Dependencies

- Task 2 依赖 Task 1（数据库 schema）
- Task 3 依赖 Task 2（会员服务）
- Task 4 依赖 Task 2（会员服务）
- Task 5 依赖 Task 2（会员 API）
- Task 6 依赖 Task 5（MembershipProvider）
- Task 7 依赖 Task 3（支付接口）和 Task 5（MembershipProvider）
- Task 8 依赖 Task 5（MembershipProvider）
- Task 9 依赖 Task 1（通知表）

## Parallelizable Work

- Task 3 和 Task 4 可并行开发
- Task 6、7、8 可并行开发（都依赖 Task 5）
