-- Migration: Enhance list filtering and view modes
-- Adds archived_at to notes and indexes for sorting

-- 1. Add archived_at column to notes table
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Add indexes for sorting by title and site_name
CREATE INDEX IF NOT EXISTS idx_notes_user_id_title
  ON public.notes(user_id, title);

CREATE INDEX IF NOT EXISTS idx_notes_user_id_site_name
  ON public.notes(user_id, site_name);

-- 3. Add index for archived notes filtering
CREATE INDEX IF NOT EXISTS idx_notes_user_id_archived_at
  ON public.notes(user_id, archived_at)
  WHERE archived_at IS NOT NULL;

-- 4. Add index for updated_at sorting (if not exists)
CREATE INDEX IF NOT EXISTS idx_notes_user_id_updated_at
  ON public.notes(user_id, updated_at DESC);

-- Note: content_type enum extension is deferred to future migration
-- Current types: 'article', 'video', 'audio'
-- Planned types: 'webpage', 'snippet', 'note', 'image', 'file'

