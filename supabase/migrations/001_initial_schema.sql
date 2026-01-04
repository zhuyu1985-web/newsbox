-- Migration: Initial Schema for AI News Reading Assistant
-- This migration creates all necessary tables, types, indexes, RLS policies, and triggers

-- ============================================
-- 1. ENUM Types
-- ============================================
CREATE TYPE content_type AS ENUM ('article', 'video', 'audio');
CREATE TYPE note_status AS ENUM ('unread', 'reading', 'archived');

-- ============================================
-- 2. Profiles Table (Optional user extension)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Folders Table (收藏夹/分组)
-- ============================================
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT folders_user_id_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id_position ON public.folders(user_id, position);

-- ============================================
-- 4. Notes Table (笔记/收藏条目)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  
  -- 核心字段
  source_url TEXT NOT NULL,
  content_type content_type NOT NULL DEFAULT 'article',
  
  -- 元数据
  title TEXT,
  author TEXT,
  site_name TEXT,
  published_at TIMESTAMPTZ,
  
  -- 内容
  content_html TEXT,
  content_text TEXT,
  excerpt TEXT,
  
  -- 媒体相关（视频/音频）
  cover_image_url TEXT,
  media_url TEXT,
  media_duration INTEGER,
  
  -- 状态
  status note_status DEFAULT 'unread',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束
  CONSTRAINT notes_user_id_source_url_unique UNIQUE (user_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON public.notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id_status ON public.notes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_user_id_created_at ON public.notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_content_type ON public.notes(content_type);

-- 全文检索索引（PostgreSQL）
CREATE INDEX IF NOT EXISTS idx_notes_content_text_fts ON public.notes USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, '')));

-- ============================================
-- 5. Tags Table (标签)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT tags_user_id_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id_name ON public.tags(user_id, name);

-- ============================================
-- 6. Note Tags Table (笔记-标签多对多关系)
-- ============================================
CREATE TABLE IF NOT EXISTS public.note_tags (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON public.note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON public.note_tags(tag_id);

-- ============================================
-- 7. Highlights Table (高亮)
-- ============================================
CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  
  quote TEXT NOT NULL,
  range_start INTEGER,
  range_end INTEGER,
  range_data JSONB,
  color TEXT DEFAULT '#FFEB3B',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_note_id ON public.highlights(note_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_id_note_id ON public.highlights(user_id, note_id);

-- ============================================
-- 8. Annotations Table (批注)
-- ============================================
CREATE TABLE IF NOT EXISTS public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES public.highlights(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_note_id ON public.annotations(note_id);
CREATE INDEX IF NOT EXISTS idx_annotations_highlight_id ON public.annotations(highlight_id);

-- ============================================
-- 9. AI Outputs Table (AI 输出)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  
  summary TEXT NOT NULL,
  key_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript TEXT,
  
  -- AI 模型信息（审计）
  model_name TEXT,
  provider TEXT,
  model_version TEXT,
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT ai_outputs_note_id_unique UNIQUE (note_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_user_id ON public.ai_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_note_id ON public.ai_outputs(note_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_provider ON public.ai_outputs(provider);

-- ============================================
-- 10. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Users can view their own folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view their own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view their own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- Note tags policies
CREATE POLICY "Users can view note_tags for their notes"
  ON public.note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert note_tags for their notes"
  ON public.note_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.tags
      WHERE tags.id = note_tags.tag_id AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete note_tags for their notes"
  ON public.note_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    )
  );

-- Highlights policies
CREATE POLICY "Users can view their own highlights"
  ON public.highlights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights"
  ON public.highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights"
  ON public.highlights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
  ON public.highlights FOR DELETE
  USING (auth.uid() = user_id);

-- Annotations policies
CREATE POLICY "Users can view their own annotations"
  ON public.annotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own annotations"
  ON public.annotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations"
  ON public.annotations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations"
  ON public.annotations FOR DELETE
  USING (auth.uid() = user_id);

-- AI outputs policies
CREATE POLICY "Users can view their own ai_outputs"
  ON public.ai_outputs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai_outputs"
  ON public.ai_outputs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai_outputs"
  ON public.ai_outputs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai_outputs"
  ON public.ai_outputs FOR DELETE
  USING (auth.uid() = user_id);

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- 11. Triggers for updated_at
-- ============================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_highlights_updated_at BEFORE UPDATE ON public.highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_outputs_updated_at BEFORE UPDATE ON public.ai_outputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

