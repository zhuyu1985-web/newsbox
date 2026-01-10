-- Quote Materials (金句素材)

CREATE TABLE IF NOT EXISTS public.quote_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES public.highlights(id) ON DELETE SET NULL,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_materials_user_id ON public.quote_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_materials_note_id ON public.quote_materials(note_id);
CREATE INDEX IF NOT EXISTS idx_quote_materials_created_at ON public.quote_materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_materials_source_type ON public.quote_materials(source_type);
CREATE INDEX IF NOT EXISTS idx_quote_materials_annotation_id ON public.quote_materials(annotation_id);
CREATE INDEX IF NOT EXISTS idx_quote_materials_highlight_id ON public.quote_materials(highlight_id);

-- Avoid duplicates within the same note
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_materials_user_note_hash
  ON public.quote_materials(user_id, note_id, content_hash);

-- At most one material per annotation/highlight when explicitly linked
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_materials_user_annotation_id
  ON public.quote_materials(user_id, annotation_id)
  WHERE annotation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_materials_user_highlight_id
  ON public.quote_materials(user_id, highlight_id)
  WHERE highlight_id IS NOT NULL;

ALTER TABLE public.quote_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quote_materials"
  ON public.quote_materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quote_materials"
  ON public.quote_materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quote_materials"
  ON public.quote_materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quote_materials"
  ON public.quote_materials FOR DELETE
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_quote_materials_updated_at ON public.quote_materials;
    CREATE TRIGGER update_quote_materials_updated_at
      BEFORE UPDATE ON public.quote_materials
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

