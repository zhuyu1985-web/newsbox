-- ==========================================================================
-- Migration 014: 知识库智能专题（embedding + topic + member）
-- Description: 支持 P1 智能专题聚类结果持久化与用户隔离（RLS）
-- Created: 2026-01-02
-- ==========================================================================

-- 1) knowledge_note_embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_note_embeddings (
  note_id UUID PRIMARY KEY REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_note_embeddings_user_id
  ON public.knowledge_note_embeddings(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_note_embeddings_user_id_updated_at
  ON public.knowledge_note_embeddings(user_id, updated_at DESC);

-- 2) knowledge_topics
CREATE TABLE IF NOT EXISTS public.knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  summary_markdown TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,

  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_user_id
  ON public.knowledge_topics(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_user_id_updated_at
  ON public.knowledge_topics(user_id, updated_at DESC);

-- 3) knowledge_topic_members
CREATE TABLE IF NOT EXISTS public.knowledge_topic_members (
  topic_id UUID NOT NULL REFERENCES public.knowledge_topics(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  score REAL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (topic_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_members_user_id
  ON public.knowledge_topic_members(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_members_topic_id
  ON public.knowledge_topic_members(topic_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic_members_note_id
  ON public.knowledge_topic_members(note_id);

-- 4) RLS
ALTER TABLE public.knowledge_note_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_topic_members ENABLE ROW LEVEL SECURITY;

-- 4.1 embeddings policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own knowledge note embeddings" ON public.knowledge_note_embeddings;
DROP POLICY IF EXISTS "Users can insert their own knowledge note embeddings" ON public.knowledge_note_embeddings;
DROP POLICY IF EXISTS "Users can update their own knowledge note embeddings" ON public.knowledge_note_embeddings;
DROP POLICY IF EXISTS "Users can delete their own knowledge note embeddings" ON public.knowledge_note_embeddings;

CREATE POLICY "Users can view their own knowledge note embeddings"
  ON public.knowledge_note_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge note embeddings"
  ON public.knowledge_note_embeddings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = knowledge_note_embeddings.note_id
        AND n.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own knowledge note embeddings"
  ON public.knowledge_note_embeddings FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = knowledge_note_embeddings.note_id
        AND n.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own knowledge note embeddings"
  ON public.knowledge_note_embeddings FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = knowledge_note_embeddings.note_id
        AND n.user_id = auth.uid()
    )
  );

-- 4.2 topics policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own knowledge topics" ON public.knowledge_topics;
DROP POLICY IF EXISTS "Users can insert their own knowledge topics" ON public.knowledge_topics;
DROP POLICY IF EXISTS "Users can update their own knowledge topics" ON public.knowledge_topics;
DROP POLICY IF EXISTS "Users can delete their own knowledge topics" ON public.knowledge_topics;

CREATE POLICY "Users can view their own knowledge topics"
  ON public.knowledge_topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge topics"
  ON public.knowledge_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge topics"
  ON public.knowledge_topics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge topics"
  ON public.knowledge_topics FOR DELETE
  USING (auth.uid() = user_id);

-- 4.3 topic_members policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own knowledge topic members" ON public.knowledge_topic_members;
DROP POLICY IF EXISTS "Users can insert their own knowledge topic members" ON public.knowledge_topic_members;
DROP POLICY IF EXISTS "Users can update their own knowledge topic members" ON public.knowledge_topic_members;
DROP POLICY IF EXISTS "Users can delete their own knowledge topic members" ON public.knowledge_topic_members;

CREATE POLICY "Users can view their own knowledge topic members"
  ON public.knowledge_topic_members FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_members.topic_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own knowledge topic members"
  ON public.knowledge_topic_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_members.topic_id
        AND t.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = knowledge_topic_members.note_id
        AND n.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own knowledge topic members"
  ON public.knowledge_topic_members FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_members.topic_id
        AND t.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = knowledge_topic_members.note_id
        AND n.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own knowledge topic members"
  ON public.knowledge_topic_members FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.knowledge_topics t
      WHERE t.id = knowledge_topic_members.topic_id
        AND t.user_id = auth.uid()
    )
  );

-- 5) updated_at triggers (idempotent)
DROP TRIGGER IF EXISTS update_knowledge_note_embeddings_updated_at ON public.knowledge_note_embeddings;
DROP TRIGGER IF EXISTS update_knowledge_topics_updated_at ON public.knowledge_topics;
DROP TRIGGER IF EXISTS update_knowledge_topic_members_updated_at ON public.knowledge_topic_members;

CREATE TRIGGER update_knowledge_note_embeddings_updated_at
  BEFORE UPDATE ON public.knowledge_note_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_topics_updated_at
  BEFORE UPDATE ON public.knowledge_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_topic_members_updated_at
  BEFORE UPDATE ON public.knowledge_topic_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
