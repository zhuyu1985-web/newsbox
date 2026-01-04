-- Migration: Alternative Storage Bucket RLS Policies
-- This migration uses a more reliable approach for Storage RLS policies
-- Bucket name: zhuyu

-- First, ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload files to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to zhuyu" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read from zhuyu" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update in zhuyu" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from zhuyu" ON storage.objects;

-- Alternative approach: Use string matching instead of foldername function
-- File path format: {user_id}/{timestamp}-{filename}
-- This checks if the path starts with the user's UUID followed by a slash

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to zhuyu"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read from zhuyu"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update in zhuyu"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
)
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete from zhuyu"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND bucket_id = 'zhuyu';

