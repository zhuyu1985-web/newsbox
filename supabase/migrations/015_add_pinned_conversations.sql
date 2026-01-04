-- ==========================================================================
-- Migration 015: 知识库对话置顶（pinned）
-- Description: 支持对话置顶/取消置顶，便于快速访问重要会话
-- Created: 2026-01-02
-- ==========================================================================

ALTER TABLE public.knowledge_conversations
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.knowledge_conversations
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- 常用排序：user_id + pinned(desc) + pinned_at(desc) + updated_at(desc)
CREATE INDEX IF NOT EXISTS idx_knowledge_conversations_user_pinned
  ON public.knowledge_conversations (user_id, pinned DESC, pinned_at DESC, updated_at DESC);
