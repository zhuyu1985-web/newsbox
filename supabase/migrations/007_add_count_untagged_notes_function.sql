-- Migration: Add count_untagged_notes RPC function
-- Description: Creates a function to count notes that have no tags
-- Date: 2025-12-25

-- Create RPC function to count notes with no tags
CREATE OR REPLACE FUNCTION public.count_untagged_notes()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notes n
  WHERE n.user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.note_tags nt
      WHERE nt.note_id = n.id
    );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.count_untagged_notes() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.count_untagged_notes() IS 'Returns the count of notes that have no tags for the current user';

