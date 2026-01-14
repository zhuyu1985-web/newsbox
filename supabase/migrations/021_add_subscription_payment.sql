-- ============================================================================
-- Migration 021: 订阅支付系统
-- Description: 添加会员等级、订单表、通知表，支持订阅付费功能
-- Created: 2025-01-14
-- ============================================================================

-- ============================================================================
-- 1. 扩展 user_memberships 表
-- ============================================================================

-- 添加 plan_type 字段：会员类型
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN plan_type TEXT DEFAULT 'trial';
    COMMENT ON COLUMN public.user_memberships.plan_type IS '会员类型: trial(试用), pro(基础), ai(高级), expired(过期)';
  END IF;
END $$;

-- 添加 trial_started_at 字段：试用开始时间
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN trial_started_at TIMESTAMPTZ;
    COMMENT ON COLUMN public.user_memberships.trial_started_at IS '试用期开始时间';
  END IF;
END $$;

-- 添加 last_payment_at 字段：最后支付时间
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'last_payment_at'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN last_payment_at TIMESTAMPTZ;
    COMMENT ON COLUMN public.user_memberships.last_payment_at IS '最后支付时间';
  END IF;
END $$;

-- ============================================================================
-- 2. 创建订单表 subscription_orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  out_trade_no TEXT NOT NULL UNIQUE,           -- 商户订单号
  trade_no TEXT,                                -- 支付平台订单号 (z-pay返回)
  plan_type TEXT NOT NULL,                      -- 'pro' | 'ai'
  amount DECIMAL(10,2) NOT NULL,                -- 订单金额
  status TEXT NOT NULL DEFAULT 'pending',       -- 'pending' | 'paid' | 'failed' | 'refunded'
  pay_type TEXT,                                -- 'alipay' | 'wxpay'
  paid_at TIMESTAMPTZ,                          -- 支付时间
  expires_at TIMESTAMPTZ,                       -- 该订单对应的会员到期时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_orders_user_id ON public.subscription_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_out_trade_no ON public.subscription_orders(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON public.subscription_orders(status);

COMMENT ON TABLE public.subscription_orders IS '订阅订单表，记录所有支付订单';

-- ============================================================================
-- 3. 创建通知表 user_notifications（如不存在）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                           -- 通知类型
  title TEXT NOT NULL,                          -- 通知标题
  message TEXT NOT NULL,                        -- 通知内容
  link TEXT,                                    -- 可选的跳转链接
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON public.user_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON public.user_notifications(type);

COMMENT ON TABLE public.user_notifications IS '用户通知表，支持会员到期提醒等通知';

-- ============================================================================
-- 4. RLS 策略
-- ============================================================================

-- subscription_orders RLS
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_orders' AND policyname = 'Users can view their own orders'
  ) THEN
    CREATE POLICY "Users can view their own orders"
      ON public.subscription_orders FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_orders' AND policyname = 'Users can insert their own orders'
  ) THEN
    CREATE POLICY "Users can insert their own orders"
      ON public.subscription_orders FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Service role can update orders (for payment callbacks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_orders' AND policyname = 'Service role can update orders'
  ) THEN
    CREATE POLICY "Service role can update orders"
      ON public.subscription_orders FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- user_notifications RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notifications' AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.user_notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notifications' AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.user_notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notifications' AND policyname = 'Service role can insert notifications'
  ) THEN
    CREATE POLICY "Service role can insert notifications"
      ON public.user_notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 5. 触发器：自动更新 updated_at
-- ============================================================================

CREATE OR REPLACE TRIGGER update_subscription_orders_updated_at
  BEFORE UPDATE ON public.subscription_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 初始化现有用户的 trial_started_at
-- ============================================================================

-- 为现有用户设置 trial_started_at（使用 auth.users 的 created_at）
-- 注意：这个操作只在用户还没有 trial_started_at 时执行
DO $$
BEGIN
  -- 先确保所有 auth.users 都有对应的 user_memberships 记录
  INSERT INTO public.user_memberships (user_id, plan_type, trial_started_at, updated_at)
  SELECT 
    u.id,
    'trial',
    u.created_at,
    NOW()
  FROM auth.users u
  LEFT JOIN public.user_memberships um ON u.id = um.user_id
  WHERE um.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;

  -- 更新已存在但没有 trial_started_at 的记录
  UPDATE public.user_memberships um
  SET 
    trial_started_at = COALESCE(um.trial_started_at, u.created_at),
    plan_type = COALESCE(NULLIF(um.plan_type, ''), 'trial')
  FROM auth.users u
  WHERE um.user_id = u.id
    AND um.trial_started_at IS NULL;
END $$;

-- ============================================================================
-- 7. 创建获取会员状态的函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_membership_status(p_user_id UUID)
RETURNS TABLE (
  plan_type TEXT,
  is_active BOOLEAN,
  can_access_pro BOOLEAN,
  can_access_ai BOOLEAN,
  expires_at TIMESTAMPTZ,
  days_remaining INTEGER,
  is_trial BOOLEAN,
  is_trial_expired BOOLEAN
) AS $$
DECLARE
  v_membership RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_trial_days INTEGER := 14;
  v_trial_end TIMESTAMPTZ;
  v_is_in_trial BOOLEAN;
  v_is_trial_expired BOOLEAN;
  v_is_active BOOLEAN;
  v_days_remaining INTEGER;
BEGIN
  -- 获取会员记录
  SELECT * INTO v_membership
  FROM public.user_memberships
  WHERE user_id = p_user_id;

  -- 如果没有会员记录，返回默认状态
  IF v_membership IS NULL THEN
    RETURN QUERY SELECT 
      'none'::TEXT,
      FALSE,
      FALSE,
      FALSE,
      NULL::TIMESTAMPTZ,
      0,
      FALSE,
      TRUE;
    RETURN;
  END IF;

  -- 计算试用期结束时间
  v_trial_end := v_membership.trial_started_at + (v_trial_days || ' days')::INTERVAL;
  v_is_in_trial := v_membership.trial_started_at IS NOT NULL AND v_now < v_trial_end;
  v_is_trial_expired := v_membership.trial_started_at IS NOT NULL AND v_now >= v_trial_end;

  -- 如果在试用期内
  IF v_is_in_trial THEN
    v_days_remaining := EXTRACT(DAY FROM (v_trial_end - v_now))::INTEGER;
    RETURN QUERY SELECT 
      'trial'::TEXT,
      TRUE,
      TRUE,
      TRUE,
      v_trial_end,
      v_days_remaining,
      TRUE,
      FALSE;
    RETURN;
  END IF;

  -- 检查付费会员状态
  v_is_active := v_membership.expires_at IS NOT NULL AND v_membership.expires_at > v_now;
  
  IF v_is_active THEN
    v_days_remaining := EXTRACT(DAY FROM (v_membership.expires_at - v_now))::INTEGER;
    RETURN QUERY SELECT 
      v_membership.plan_type,
      TRUE,
      v_membership.plan_type IN ('pro', 'ai'),
      v_membership.plan_type = 'ai',
      v_membership.expires_at,
      v_days_remaining,
      FALSE,
      v_is_trial_expired;
    RETURN;
  END IF;

  -- 过期状态
  RETURN QUERY SELECT 
    'expired'::TEXT,
    FALSE,
    FALSE,
    FALSE,
    v_membership.expires_at,
    0,
    FALSE,
    v_is_trial_expired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 完成
-- ============================================================================

COMMENT ON SCHEMA public IS 'Migration 021: 订阅支付系统数据库架构已就绪';
