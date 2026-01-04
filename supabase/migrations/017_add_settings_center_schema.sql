-- Migration: Add Settings Center schema (soft delete, visit events, referral rewards)

-- ============================================
-- 1) Soft delete for notes (Recycle Bin)
-- ============================================
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notes_user_id_deleted_at
  ON public.notes(user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- ============================================
-- 2) Visit events (for usage stats + TOP domains)
-- ============================================
CREATE TABLE IF NOT EXISTS public.note_visit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'reader',
  source_url TEXT,
  source_domain TEXT,
  site_name TEXT,
  content_type content_type
);

CREATE INDEX IF NOT EXISTS idx_note_visit_events_user_time
  ON public.note_visit_events(user_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_note_visit_events_user_domain
  ON public.note_visit_events(user_id, source_domain);

ALTER TABLE public.note_visit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'note_visit_events'
      AND policyname = 'note_visit_events_select_own'
  ) THEN
    CREATE POLICY note_visit_events_select_own
      ON public.note_visit_events
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'note_visit_events'
      AND policyname = 'note_visit_events_insert_own'
  ) THEN
    CREATE POLICY note_visit_events_insert_own
      ON public.note_visit_events
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 3) Membership rewards via referral codes
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  invite_rewarded_days INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redeemer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_granted INTEGER NOT NULL DEFAULT 7,
  CONSTRAINT referral_redemptions_redeemer_unique UNIQUE (redeemer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_inviter
  ON public.referral_redemptions(inviter_user_id, redeemed_at DESC);

ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_memberships' AND policyname='user_memberships_select_own'
  ) THEN
    CREATE POLICY user_memberships_select_own
      ON public.user_memberships
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_memberships' AND policyname='user_memberships_upsert_own'
  ) THEN
    CREATE POLICY user_memberships_upsert_own
      ON public.user_memberships
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_memberships' AND policyname='user_memberships_update_own'
  ) THEN
    CREATE POLICY user_memberships_update_own
      ON public.user_memberships
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- referral codes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_referral_codes' AND policyname='user_referral_codes_select_own'
  ) THEN
    CREATE POLICY user_referral_codes_select_own
      ON public.user_referral_codes
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_referral_codes' AND policyname='user_referral_codes_insert_own'
  ) THEN
    CREATE POLICY user_referral_codes_insert_own
      ON public.user_referral_codes
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- redemptions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='referral_redemptions' AND policyname='referral_redemptions_select_own'
  ) THEN
    CREATE POLICY referral_redemptions_select_own
      ON public.referral_redemptions
      FOR SELECT TO authenticated
      USING (auth.uid() = redeemer_user_id OR auth.uid() = inviter_user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='referral_redemptions' AND policyname='referral_redemptions_insert_own'
  ) THEN
    CREATE POLICY referral_redemptions_insert_own
      ON public.referral_redemptions
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = redeemer_user_id);
  END IF;
END $$;


