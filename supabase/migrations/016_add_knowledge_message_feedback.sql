-- ==========================================================================
-- Migration 016: knowledge_messages feedback fields
-- Description: 支持对话消息的喜欢/不喜欢（rating），便于收集反馈与改进回答
-- Created: 2026-01-03
-- ==========================================================================

ALTER TABLE public.knowledge_messages
  ADD COLUMN IF NOT EXISTS rating SMALLINT;

-- 仅允许 -1 / 1（NULL 表示无反馈）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_messages_rating_check'
  ) THEN
    ALTER TABLE public.knowledge_messages
      ADD CONSTRAINT knowledge_messages_rating_check
      CHECK (rating IS NULL OR rating IN (-1, 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_messages_rating
  ON public.knowledge_messages(rating);
