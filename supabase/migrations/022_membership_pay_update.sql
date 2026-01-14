-- 1. 添加缺失的字段到 user_memberships 表
DO $$
BEGIN
  -- 添加 plan_type 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN plan_type TEXT DEFAULT 'trial';
  END IF;

  -- 添加 expires_at 字段（这是关键字段！）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;

  -- 添加 trial_started_at 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN trial_started_at TIMESTAMPTZ;
  END IF;

  -- 添加 last_payment_at 字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_memberships' AND column_name = 'last_payment_at'
  ) THEN
    ALTER TABLE public.user_memberships ADD COLUMN last_payment_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. 创建订单表（如果不存在）
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  out_trade_no TEXT NOT NULL UNIQUE,
  trade_no TEXT,
  plan_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pay_type TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 启用 RLS
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略（先检查是否存在）
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