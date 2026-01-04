-- Migration: Add AI Snapshot Persistence (DB only)
-- Note: Storage bucket/policies are NOT managed here due to limited permissions in this environment.
-- We will reuse the existing Storage bucket (default: "zhuyu") and store objects under the user_id prefix.

-- 1) Tables
CREATE TABLE IF NOT EXISTS public.ai_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,

  card_data JSONB,
  model_provider TEXT,
  model_name TEXT,
  model_version TEXT,

  status TEXT NOT NULL DEFAULT 'generating',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ai_snapshots_note_hash_unique UNIQUE (note_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_snapshots_user_note_updated
  ON public.ai_snapshots(user_id, note_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_snapshot_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.ai_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,

  template TEXT NOT NULL,
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  width INT NOT NULL DEFAULT 1200,
  height INT NOT NULL DEFAULT 1600,
  content_type TEXT NOT NULL DEFAULT 'image/png',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ai_snapshot_renders_snapshot_template_unique UNIQUE (snapshot_id, template)
);

CREATE INDEX IF NOT EXISTS idx_ai_snapshot_renders_user_note
  ON public.ai_snapshot_renders(user_id, note_id);

-- 2) RLS
ALTER TABLE public.ai_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_snapshot_renders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view their own ai_snapshots"
  ON public.ai_snapshots FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert their own ai_snapshots"
  ON public.ai_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update their own ai_snapshots"
  ON public.ai_snapshots FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete their own ai_snapshots"
  ON public.ai_snapshots FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can view their own ai_snapshot_renders"
  ON public.ai_snapshot_renders FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert their own ai_snapshot_renders"
  ON public.ai_snapshot_renders FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update their own ai_snapshot_renders"
  ON public.ai_snapshot_renders FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete their own ai_snapshot_renders"
  ON public.ai_snapshot_renders FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) updated_at trigger (function is expected to already exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_ai_snapshots_updated_at ON public.ai_snapshots;
    CREATE TRIGGER update_ai_snapshots_updated_at
      BEFORE UPDATE ON public.ai_snapshots
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
