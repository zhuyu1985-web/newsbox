-- Migration: Enhance folder hierarchy & management

-- 1. Add hierarchical + metadata columns -----------------------------------
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS parent_id UUID,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Self-referencing foreign key (guarded to avoid duplicate creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'folders_parent_fk'
      AND conrelid = 'public.folders'::regclass
  ) THEN
ALTER TABLE public.folders
      ADD CONSTRAINT folders_parent_fk
  FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Replace the old unique constraint so users can reuse names in archived folders
ALTER TABLE public.folders
  DROP CONSTRAINT IF EXISTS folders_user_id_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_user_parent_name_active
  ON public.folders(user_id, parent_id, name)
  WHERE archived_at IS NULL;

-- 4. Helpful indexes for hierarchy & archive filters ------------------------
CREATE INDEX IF NOT EXISTS idx_folders_user_parent
  ON public.folders(user_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_folders_user_archived
  ON public.folders(user_id)
  WHERE archived_at IS NOT NULL;

