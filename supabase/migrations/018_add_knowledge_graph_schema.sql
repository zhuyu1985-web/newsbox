-- ==========================================================================
-- Migration 018: 知识图谱基础架构 - 实体与关系
-- Description: 新增 knowledge_entities, knowledge_relationships, knowledge_note_entities
-- ==========================================================================

-- 1. 实体表 (Nodes)
CREATE TABLE IF NOT EXISTS public.knowledge_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT, -- PERSON, ORG, GPE (Location), EVENT, TECH, WORK_OF_ART
  description TEXT, -- AI 生成的简介
  aliases TEXT[] DEFAULT '{}', -- 别名
  avatar_url TEXT, -- 预留头像/图标
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_user_id ON public.knowledge_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_name_user_id ON public.knowledge_entities(name, user_id);

-- 2. 实体关系表 (Edges)
CREATE TABLE IF NOT EXISTS public.knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  source_entity_id UUID NOT NULL REFERENCES public.knowledge_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.knowledge_entities(id) ON DELETE CASCADE,
  
  relation TEXT NOT NULL, -- 谓语，如 "founded", "invested in"
  
  -- 证据溯源
  source_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  evidence_snippet TEXT, -- 原始文本片段
  confidence_score REAL DEFAULT 1.0,
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_user_id ON public.knowledge_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source ON public.knowledge_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target ON public.knowledge_relationships(target_entity_id);

-- 3. 笔记与实体的关联表 (Mentions)
CREATE TABLE IF NOT EXISTS public.knowledge_note_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.knowledge_entities(id) ON DELETE CASCADE,
  
  mention_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_note_entities_note_id ON public.knowledge_note_entities(note_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_note_entities_entity_id ON public.knowledge_note_entities(entity_id);

-- 4. RLS 策略

ALTER TABLE public.knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_note_entities ENABLE ROW LEVEL SECURITY;

-- Entities
CREATE POLICY "Users can manage their own knowledge entities"
  ON public.knowledge_entities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Relationships
CREATE POLICY "Users can manage their own knowledge relationships"
  ON public.knowledge_relationships FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note Entities
CREATE POLICY "Users can manage their own knowledge note entities"
  ON public.knowledge_note_entities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. 自动更新 updated_at
CREATE TRIGGER update_knowledge_entities_updated_at
  BEFORE UPDATE ON public.knowledge_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
