-- Migration: Enhance My Collections data model

-- 1. Types --------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_source_type') THEN
    CREATE TYPE note_source_type AS ENUM ('url', 'manual', 'upload');
  END IF;
END $$;

-- 2. Notes table new columns --------------------------------
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS source_type note_source_type NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 3. Allow manual notes without URLs ------------------------
ALTER TABLE public.notes
  ALTER COLUMN source_url DROP NOT NULL;

ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_user_id_source_url_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_id_source_url_unique
  ON public.notes(user_id, source_url)
  WHERE source_url IS NOT NULL;

-- 4. Backfill captured_at for existing rows -----------------
UPDATE public.notes
SET captured_at = COALESCE(captured_at, created_at)
WHERE captured_at IS NULL;

-- 5. Helpful indexes ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_notes_user_id_is_starred
  ON public.notes(user_id, is_starred)
  WHERE is_starred = TRUE;

CREATE INDEX IF NOT EXISTS idx_notes_user_id_captured_at
  ON public.notes(user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user_id_source_type
  ON public.notes(user_id, source_type);
