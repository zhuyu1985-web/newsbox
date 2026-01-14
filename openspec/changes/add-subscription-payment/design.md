# Design: Subscription Payment System

## Context

NewsBox 需要从免费产品转型为 SaaS 订阅模式。当前系统已有基础的会员表 `user_memberships`（用于邀请奖励），需要扩展支持付费订阅、会员等级、权限检查等功能。

**约束条件**：
- 使用 z-pay 作为支付网关（第三方聚合支付）
- 支持支付宝和微信支付
- 年费订阅模式，无月付选项
- 必须保证支付安全（签名验证、幂等处理）

**利益相关方**：
- 用户：期望简单的支付流程和清晰的权益说明
- 产品：需要会员数据统计和续费提醒
- 财务：需要订单记录和对账能力

## Goals / Non-Goals

### Goals
- 实现完整的订阅付费流程（选择方案 → 支付 → 开通）
- 实现会员权限分级（试用/Pro/AI）
- 实现 AI 功能权限检查
- 实现到期提醒和续费引导

### Non-Goals
- 不支持月付订阅（仅年费）
- 不支持线下支付或银行转账
- 不支持多币种（仅人民币）
- 不支持团队/企业订阅

## Decisions

### 1. 数据模型设计

**Decision**: 扩展现有 `user_memberships` 表 + 新增 `subscription_orders` 表

```sql
-- 扩展 user_memberships 表
ALTER TABLE user_memberships ADD COLUMN plan_type TEXT DEFAULT 'trial';
-- plan_type: 'trial' | 'pro' | 'ai' | 'expired'
ALTER TABLE user_memberships ADD COLUMN trial_started_at TIMESTAMPTZ;
ALTER TABLE user_memberships ADD COLUMN last_payment_at TIMESTAMPTZ;

-- 新增订单表
CREATE TABLE subscription_orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  out_trade_no TEXT NOT NULL UNIQUE,      -- 商户订单号
  trade_no TEXT,                           -- 支付平台订单号
  plan_type TEXT NOT NULL,                 -- 'pro' | 'ai'
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'failed' | 'refunded'
  pay_type TEXT,                           -- 'alipay' | 'wxpay'
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                  -- 该订单对应的会员到期时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alternatives considered**:
- 使用独立的 `subscriptions` 表：增加复杂度，当前需求不需要

### 2. 会员状态计算

**Decision**: 基于 `plan_type` + `expires_at` 实时计算用户权限状态

```typescript
type MembershipStatus = {
  planType: 'trial' | 'pro' | 'ai' | 'expired' | 'none';
  isActive: boolean;          // 是否有效（未过期）
  canAccessPro: boolean;      // 是否可访问 Pro 功能
  canAccessAI: boolean;       // 是否可访问 AI 功能
  expiresAt: Date | null;
  daysRemaining: number;
  isTrialExpired: boolean;
};

function calculateMembershipStatus(membership: UserMembership): MembershipStatus {
  const now = new Date();
  const expiresAt = membership?.expires_at ? new Date(membership.expires_at) : null;
  const isActive = expiresAt ? expiresAt > now : false;
  const trialStartedAt = membership?.trial_started_at ? new Date(membership.trial_started_at) : null;
  
  // 试用期判断：注册后 14 天内
  const TRIAL_DAYS = 14;
  const isInTrial = trialStartedAt && 
    (now.getTime() - trialStartedAt.getTime()) < TRIAL_DAYS * 24 * 60 * 60 * 1000;
  
  if (isInTrial) {
    return { planType: 'trial', isActive: true, canAccessPro: true, canAccessAI: true, ... };
  }
  
  if (!isActive) {
    return { planType: 'expired', isActive: false, canAccessPro: false, canAccessAI: false, ... };
  }
  
  const planType = membership.plan_type;
  return {
    planType,
    isActive: true,
    canAccessPro: planType === 'pro' || planType === 'ai',
    canAccessAI: planType === 'ai',
    ...
  };
}
```

### 3. 支付流程设计

**Decision**: 采用服务端生成支付链接 → 跳转 z-pay → 异步回调确认的模式

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Frontend│     │ Backend │     │  z-pay  │     │ Callback│
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │ 1. 选择方案    │               │               │
     │───────────────>│               │               │
     │               │ 2. 生成订单    │               │
     │               │ 3. 签名参数    │               │
     │ 4. 返回支付URL │               │               │
     │<───────────────│               │               │
     │ 5. 跳转支付    │               │               │
     │────────────────────────────────>│               │
     │               │               │ 6. 用户支付    │
     │               │               │ 7. 异步通知    │
     │               │               │───────────────>│
     │               │               │               │ 8. 验签
     │               │               │               │ 9. 更新订单
     │               │               │               │ 10. 开通会员
     │               │ 11. 同步跳转   │               │
     │<──────────────────────────────│               │
     │ 12. 显示结果   │               │               │
```

### 4. 权限检查策略

**Decision**: 使用 React Context + API 中间件双层检查

- **前端**：`MembershipProvider` 提供会员状态，AI 组件检查 `canAccessAI` 显示升级提示
- **后端**：API 路由中间件验证权限，返回 403 + 升级提示

```typescript
// 前端 Hook
function useAIFeatureGuard() {
  const { canAccessAI } = useMembership();
  
  const checkAccess = useCallback((onBlocked?: () => void) => {
    if (!canAccessAI) {
      showUpgradeDialog('此功能需要 NewsBox AI 会员');
      onBlocked?.();
      return false;
    }
    return true;
  }, [canAccessAI]);
  
  return { canAccessAI, checkAccess };
}

// 后端中间件
async function requireAIMembership(req: Request) {
  const membership = await getMembershipStatus(userId);
  if (!membership.canAccessAI) {
    return NextResponse.json(
      { error: 'AI_MEMBERSHIP_REQUIRED', message: '此功能需要 NewsBox AI 会员' },
      { status: 403 }
    );
  }
}
```

### 5. 到期提醒机制

**Decision**: 使用 Supabase Edge Function 定时任务 + 系统通知表

- **定时任务**：每天运行一次，查找 7 天/3 天内到期的用户，插入通知记录
- **前端**：Dashboard 通知栏读取通知并显示

```sql
-- 通知表（如已存在可复用）
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,         -- 'membership_expiring' | 'membership_expired'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| z-pay 服务不可用 | 用户无法支付 | 记录失败日志，提供客服联系方式 |
| 回调丢失导致订单未确认 | 用户付款但未开通 | 支持手动订单查询、定时对账 |
| 试用期绕过 | 多账号薅羊毛 | 暂不处理，后续可增加设备指纹 |
| 会员权限缓存不一致 | 付款后仍显示未订阅 | 支付成功后强制刷新状态 |

## Migration Plan

1. **Phase 1 - 数据库迁移**
   - 执行 schema 变更
   - 为现有用户初始化 `trial_started_at`（设为注册时间）
   
2. **Phase 2 - 后端 API**
   - 部署支付接口和回调
   - 部署权限检查中间件
   
3. **Phase 3 - 前端适配**
   - 更新 /pricing 页面
   - 添加登录拦截
   - 添加 AI 功能权限检查

4. **Rollback**
   - 如出现问题，可暂时禁用权限检查（通过环境变量）
   - 已付款用户数据保留，不受影响

## Open Questions

1. z-pay 的 `pid` 和 `key` 将通过环境变量配置，命名为 `ZPAY_PID` 和 `ZPAY_KEY`
2. 回调地址需要公网可访问，可能需要 ngrok 或部署到 Vercel
3. 是否需要支持订单状态轮询（作为回调的备用方案）？
