-- Migration: Add Tag Management
-- This migration extends the tags table to support hierarchical organization,
-- custom ordering, and archiving functionality.

-- ============================================
-- 1. Add new columns to tags table
-- ============================================

-- Add parent_id for hierarchical tags
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tags(id) ON DELETE CASCADE;

-- Add position for custom ordering
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Add icon for visual distinction (emoji or icon name)
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS icon TEXT;

-- Add archived_at for soft delete
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ============================================
-- 2. Update unique constraints
-- ============================================

-- Drop existing unique constraint (globally unique names)
ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_user_id_name_unique;

-- Create new unique index allowing same names under different parents
-- Only enforce uniqueness for non-archived tags
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_parent_name_active
  ON public.tags(user_id, COALESCE(parent_id::text, 'root'), name)
  WHERE archived_at IS NULL;

-- ============================================
-- 3. Add check constraints
-- ============================================

-- Prevent self-referencing (tag cannot be its own parent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_no_self_reference'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_no_self_reference CHECK (id != parent_id);
  END IF;
END $$;

-- ============================================
-- 4. Add indexes for efficient queries
-- ============================================

-- Index for querying tags by user and parent
CREATE INDEX IF NOT EXISTS idx_tags_user_parent ON public.tags(user_id, parent_id);

-- Index for querying tags by user and position (for custom sorting)
CREATE INDEX IF NOT EXISTS idx_tags_user_position ON public.tags(user_id, position);

-- Index for querying archived tags
CREATE INDEX IF NOT EXISTS idx_tags_user_archived ON public.tags(user_id, archived_at);

-- Index for querying children by parent and position
CREATE INDEX IF NOT EXISTS idx_tags_parent_position ON public.tags(parent_id, position);

-- ============================================
-- 5. Backfill position for existing tags
-- ============================================

-- Assign position based on created_at order for existing tags
WITH ranked_tags AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, parent_id ORDER BY created_at) - 1 AS new_position
  FROM public.tags
  WHERE position = 0 OR position IS NULL
)
UPDATE public.tags
SET position = ranked_tags.new_position
FROM ranked_tags
WHERE public.tags.id = ranked_tags.id;

-- ============================================
-- 6. Comments for documentation
-- ============================================

COMMENT ON COLUMN public.tags.parent_id IS 'Parent tag ID for hierarchical organization. NULL for root tags.';
COMMENT ON COLUMN public.tags.position IS 'Position for custom ordering within the same parent level. Lower values appear first.';
COMMENT ON COLUMN public.tags.icon IS 'Icon representation (emoji or icon name) for visual distinction.';
COMMENT ON COLUMN public.tags.archived_at IS 'Timestamp when tag was archived (soft delete). NULL for active tags.';

