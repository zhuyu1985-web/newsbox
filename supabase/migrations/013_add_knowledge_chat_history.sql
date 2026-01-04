-- ==========================================================================
-- Migration 013: 知识库对话历史（会话 + 消息）
-- Description: 支持多会话、对话列表、消息持久化与 RLS
-- Created: 2026-01-01
-- ==========================================================================

-- 1) knowledge_conversations
CREATE TABLE IF NOT EXISTS public.knowledge_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT,
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_conversations_user_id
  ON public.knowledge_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_conversations_user_last_message_at
  ON public.knowledge_conversations(user_id, last_message_at DESC);

-- 2) knowledge_messages
CREATE TABLE IF NOT EXISTS public.knowledge_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.knowledge_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_messages_conversation_id_created_at
  ON public.knowledge_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_knowledge_messages_user_id
  ON public.knowledge_messages(user_id);

-- 3) RLS
ALTER TABLE public.knowledge_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_messages ENABLE ROW LEVEL SECURITY;

-- 3.1 conversations policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own knowledge conversations" ON public.knowledge_conversations;
DROP POLICY IF EXISTS "Users can insert their own knowledge conversations" ON public.knowledge_conversations;
DROP POLICY IF EXISTS "Users can update their own knowledge conversations" ON public.knowledge_conversations;
DROP POLICY IF EXISTS "Users can delete their own knowledge conversations" ON public.knowledge_conversations;

CREATE POLICY "Users can view their own knowledge conversations"
  ON public.knowledge_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own knowledge conversations"
  ON public.knowledge_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge conversations"
  ON public.knowledge_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge conversations"
  ON public.knowledge_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- 3.2 messages policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own knowledge messages" ON public.knowledge_messages;
DROP POLICY IF EXISTS "Users can insert their own knowledge messages" ON public.knowledge_messages;
DROP POLICY IF EXISTS "Users can update their own knowledge messages" ON public.knowledge_messages;
DROP POLICY IF EXISTS "Users can delete their own knowledge messages" ON public.knowledge_messages;

CREATE POLICY "Users can view their own knowledge messages"
  ON public.knowledge_messages FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.knowledge_conversations c
      WHERE c.id = knowledge_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own knowledge messages"
  ON public.knowledge_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.knowledge_conversations c
      WHERE c.id = knowledge_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own knowledge messages"
  ON public.knowledge_messages FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.knowledge_conversations c
      WHERE c.id = knowledge_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own knowledge messages"
  ON public.knowledge_messages FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.knowledge_conversations c
      WHERE c.id = knowledge_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- 4) updated_at triggers (idempotent)
DROP TRIGGER IF EXISTS update_knowledge_conversations_updated_at ON public.knowledge_conversations;
DROP TRIGGER IF EXISTS update_knowledge_messages_updated_at ON public.knowledge_messages;

CREATE TRIGGER update_knowledge_conversations_updated_at
  BEFORE UPDATE ON public.knowledge_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_messages_updated_at
  BEFORE UPDATE ON public.knowledge_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
