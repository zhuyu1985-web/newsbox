-- ==========================================================================
-- Migration 015: 智能专题增强（P2）- 置顶/归档 + 事件时间轴 + 人工可控字段
-- Description: 扩展 knowledge_topics/knowledge_topic_members 并新增 knowledge_topic_events（含 RLS）
-- Created: 2026-01-03
-- ==========================================================================

-- 1) Extend knowledge_topics
ALTER TABLE public.knowledge_topics
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_ingested_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_user_id_pinned_updated_at
  ON public.knowledge_topics(user_id, pinned DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_user_id_archived_updated_at
  ON public.knowledge_topics(user_id, archived ASC, updated_at DESC);

-- 2) Extend knowledge_topic_members
ALTER TABLE public.knowledge_topic_members
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS manual_state TEXT NULL,
  ADD COLUMN IF NOT EXISTS event_time TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS event_fingerprint TEXT NULL,
  ADD COLUMN IF NOT EXISTS evidence_rank REAL NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_members_topic_id_event_time
  ON public.knowledge_topic_members(topic_id, event_time ASC);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_members_topic_id_event_fingerprint
  ON public.knowledge_topic_members(topic_id, event_fingerprint);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_members_user_id_source
  ON public.knowledge_topic_members(user_id, source);

-- 3) knowledge_topic_events
CREATE TABLE IF NOT EXISTS public.knowledge_topic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.knowledge_topics(id) ON DELETE CASCADE,

  event_time TIMESTAMPTZ NOT NULL,
  title TEXT NULL,
  summary TEXT NULL,
  fingerprint TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0,
  source JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT knowledge_topic_events_topic_fingerprint_unique UNIQUE(topic_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_events_user_id
  ON public.knowledge_topic_events(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_events_topic_id_event_time
  ON public.knowledge_topic_events(topic_id, event_time ASC);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_events_user_id_topic_id_event_time
  ON public.knowledge_topic_events(user_id, topic_id, event_time ASC);

-- 4) RLS for knowledge_topic_events
ALTER TABLE public.knowledge_topic_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own knowledge topic events" ON public.knowledge_topic_events;
DROP POLICY IF EXISTS "Users can insert their own knowledge topic events" ON public.knowledge_topic_events;
DROP POLICY IF EXISTS "Users can update their own knowledge topic events" ON public.knowledge_topic_events;
DROP POLICY IF EXISTS "Users can delete their own knowledge topic events" ON public.knowledge_topic_events;

CREATE POLICY "Users can view their own knowledge topic events"
  ON public.knowledge_topic_events FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_events.topic_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own knowledge topic events"
  ON public.knowledge_topic_events FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_events.topic_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own knowledge topic events"
  ON public.knowledge_topic_events FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_events.topic_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own knowledge topic events"
  ON public.knowledge_topic_events FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_events.topic_id
        AND t.user_id = auth.uid()
    )
  );

-- 5) updated_at trigger for knowledge_topic_events (idempotent)
DROP TRIGGER IF EXISTS update_knowledge_topic_events_updated_at ON public.knowledge_topic_events;

CREATE TRIGGER update_knowledge_topic_events_updated_at
  BEFORE UPDATE ON public.knowledge_topic_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
