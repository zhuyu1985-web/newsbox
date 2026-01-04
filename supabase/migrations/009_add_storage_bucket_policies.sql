-- Migration: Add Storage Bucket RLS Policies
-- This migration creates RLS policies for the storage bucket to allow authenticated users to upload and access their own files

-- Note: Storage bucket policies are created using the storage.objects table
-- The bucket name should match the one configured in NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET (default: "zhuyu")

-- Enable RLS on storage.objects (if not already enabled)
-- Note: This is typically done automatically by Supabase, but we include it for completeness

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload files to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY IF NOT EXISTS "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY IF NOT EXISTS "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY IF NOT EXISTS "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

