-- Migration: Add last_accessed_at for search history
-- This migration adds last_accessed_at to notes, folders, and tags to track recent activity

-- 1. Add last_accessed_at to main entities
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add indexes for efficient sorting by last_accessed_at
CREATE INDEX IF NOT EXISTS idx_notes_last_accessed_at ON public.notes(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_folders_last_accessed_at ON public.folders(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tags_last_accessed_at ON public.tags(user_id, last_accessed_at DESC);

-- 3. Initial backfill (optional but good for consistency)
UPDATE public.notes SET last_accessed_at = updated_at WHERE last_accessed_at IS NULL;
UPDATE public.folders SET last_accessed_at = updated_at WHERE last_accessed_at IS NULL;
UPDATE public.tags SET last_accessed_at = created_at WHERE last_accessed_at IS NULL;
