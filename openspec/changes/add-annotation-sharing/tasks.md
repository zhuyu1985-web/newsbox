## 1. Database Schema

- [ ] 1.1 Create migration file `009_add_shared_annotations.sql`
- [ ] 1.2 Create `shared_annotations` table with fields:
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key to auth.users)
  - `share_token` (TEXT, unique, indexed - used in URL)
  - `annotation_ids` (UUID[], array of annotation IDs)
  - `password_hash` (TEXT, nullable - bcrypt hashed)
  - `expires_at` (TIMESTAMPTZ, nullable)
  - `access_count` (INTEGER, default 0)
  - `last_accessed_at` (TIMESTAMPTZ, nullable)
  - `is_active` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ, default NOW())
  - `updated_at` (TIMESTAMPTZ, default NOW())
- [ ] 1.3 Create `shared_annotation_access_logs` table for analytics (optional):
  - `id` (UUID, primary key)
  - `shared_annotation_id` (UUID, foreign key)
  - `accessed_at` (TIMESTAMPTZ, default NOW())
  - `country_code` (TEXT, nullable - 2-letter ISO code)
  - `region` (TEXT, nullable)
- [ ] 1.4 Add `is_shareable` BOOLEAN column to `annotations` table (default false)
- [ ] 1.5 Add RLS policies for `shared_annotations`:
  - Users can view/create/update/delete their own shared links
  - Public SELECT access for active, non-expired shares (for unauthenticated view)
- [ ] 1.6 Add indexes:
  - `idx_shared_annotations_share_token` on `share_token`
  - `idx_shared_annotations_user_id` on `user_id`
  - `idx_shared_annotations_expires_at` on `expires_at`
  - `idx_annotations_is_shareable` on `is_shareable`
- [ ] 1.7 Create database function `generate_share_token()` to create unique 12-character alphanumeric tokens

## 2. API Routes

- [ ] 2.1 Create `app/api/share/annotations/route.ts`:
  - POST: Create new share link with password hashing (bcrypt)
  - Input validation: annotation_ids, optional password, optional expires_at
  - Return: share_token, full share URL
- [ ] 2.2 Create `app/api/share/[shareToken]/route.ts`:
  - GET: Fetch shared annotations without auth
  - Check expiration and is_active status
  - Return metadata only if password-protected (don't leak annotations)
- [ ] 2.3 Create `app/api/share/[shareToken]/access/route.ts`:
  - POST: Verify password and return annotations
  - Input: password (optional)
  - On success: increment access_count, update last_accessed_at, optionally log access
  - Return: annotations with full metadata (quote_text, note_text, screenshot_url, timecode)
- [ ] 2.4 Create `app/api/share/[shareToken]/revoke/route.ts`:
  - DELETE: Revoke (set is_active=false) share link
  - Require authentication and ownership check
- [ ] 2.5 Create `app/api/annotations/[annotationId]/shareable/route.ts`:
  - PATCH: Toggle is_shareable flag
  - Require authentication and ownership check

## 3. Frontend Components

### 3.1 Share Dialog Component
- [ ] 3.1.1 Create `components/sharing/ShareAnnotationDialog.tsx`
- [ ] 3.1.2 Implement form with fields:
  - Password (optional, text input with toggle visibility)
  - Expiration date (optional, date-time picker)
  - Share link display (read-only input with copy button)
- [ ] 3.1.3 Add "Generate Link" button that calls POST /api/share/annotations
- [ ] 3.1.4 Add "Copy Link" button with clipboard API and toast notification
- [ ] 3.1.5 Display share link format: `https://domain.com/share/[token]`

### 3.2 Reader Sidebar Integration
- [ ] 3.2.1 Update `components/reader/RightSidebar/AnnotationList.tsx`:
  - Add share icon button to each annotation card
  - Add batch select mode with "Share Selected" button
  - Add visual indicator for shareable annotations (is_shareable badge)
  - Add share link count indicator if annotation is in active shares
- [ ] 3.2.2 Implement single-annotation share flow:
  - Click share icon → Open ShareAnnotationDialog with pre-selected annotation
- [ ] 3.2.3 Implement multi-annotation share flow:
  - Enable checkbox selection mode → "Share Selected" button → Open dialog with all selected IDs

### 3.3 Global Header Integration
- [ ] 3.3.1 Update `components/reader/GlobalHeader/index.tsx`:
  - Add "Share Highlights" action in actions dropdown menu
  - Opens ShareAnnotationDialog with all shareable annotations from current note
  - Disable if no shareable annotations exist

### 3.4 Public Share View
- [ ] 3.4.1 Create `app/share/[shareToken]/page.tsx`:
  - Server-side fetch of share metadata (check expiration, password status)
  - Minimal layout (no auth, no sidebars)
  - Display source attribution (note title, URL, creation date)
- [ ] 3.4.2 Create `components/sharing/SharedAnnotationView.tsx`:
  - Render list of shared annotations with proper formatting
  - Display quote_text as blockquote
  - Display note_text as paragraph
  - Display screenshot_url as image with referrerPolicy="no-referrer"
  - Display timecode in MM:SS format
  - Display creation timestamps
- [ ] 3.4.3 Create `components/sharing/PasswordPrompt.tsx`:
  - Password input form
  - Submit button calls POST /api/share/[token]/access
  - Display error message for incorrect password
  - On success: reveal annotations

### 3.5 Share Management Interface
- [ ] 3.5.1 Create `app/dashboard/shares/page.tsx` (optional - can be added later):
  - List all user's created share links
  - Display metadata: creation date, expiration, access count, password status
  - Actions: Copy link, Edit settings, Revoke
- [ ] 3.5.2 Create `components/sharing/ShareLinkCard.tsx`:
  - Card component displaying share link metadata
  - Quick actions: Copy, Edit, Delete/Revoke

## 4. Utilities and Helpers

- [ ] 4.1 Create `lib/share/token-generator.ts`:
  - Function to generate cryptographically random 12-character alphanumeric tokens
  - Ensure uniqueness by checking against existing tokens
- [ ] 4.2 Create `lib/share/password-hash.ts`:
  - Wrap bcrypt for password hashing and verification
  - Use appropriate salt rounds (10-12)
- [ ] 4.3 Create `lib/share/expiration-check.ts`:
  - Utility to check if share link has expired
  - Return boolean and optional human-readable message
- [ ] 4.4 Update `lib/supabase/types.ts`:
  - Add TypeScript types for SharedAnnotation, SharedAnnotationAccessLog

## 5. Security and Validation

- [ ] 5.1 Add input validation for API routes:
  - Validate annotation_ids array (max 50 annotations per share)
  - Validate password length (8-64 characters if provided)
  - Validate expires_at is future date (max 1 year from now)
- [ ] 5.2 Implement rate limiting on share creation:
  - Max 10 share links per user per hour
- [ ] 5.3 Implement rate limiting on password verification:
  - Max 5 attempts per share token per 15 minutes (prevent brute force)
- [ ] 5.4 Add ownership checks:
  - Verify user owns all annotation_ids before creating share
  - Verify user owns share before revoking
- [ ] 5.5 Add CORS headers for public share view (if needed)

## 6. UI/UX Polish

- [ ] 6.1 Add loading states to all async operations
- [ ] 6.2 Add error handling with user-friendly messages:
  - Share link expired
  - Incorrect password
  - Share link not found
  - Network errors
- [ ] 6.3 Add success notifications:
  - Share link created
  - Link copied to clipboard
  - Share link revoked
- [ ] 6.4 Add confirmation dialogs:
  - Confirm before revoking share link
  - Warn if creating share without password
- [ ] 6.5 Ensure mobile-responsive design for all new components

## 7. Testing

- [ ] 7.1 Test share link creation with various configurations:
  - With password, without password
  - With expiration, without expiration
  - Single annotation, multiple annotations
- [ ] 7.2 Test share link access:
  - Valid link without password
  - Valid link with correct password
  - Valid link with incorrect password (should fail)
  - Expired link (should fail)
  - Revoked link (should fail)
- [ ] 7.3 Test annotation shareability toggle:
  - Enable sharing on private annotation
  - Disable sharing on annotation in active share (should hide from future accesses)
- [ ] 7.4 Test edge cases:
  - Share link with no annotations (should fail validation)
  - Share link with annotations from different notes (should work)
  - Share link with deleted annotations (should handle gracefully)
- [ ] 7.5 Test security:
  - Verify non-owners cannot revoke shares
  - Verify non-owners cannot create shares for others' annotations
  - Verify password hashing (passwords not stored in plaintext)
  - Verify rate limiting works

## 8. Documentation

- [ ] 8.1 Update README.md with share link feature description
- [ ] 8.2 Add API documentation for new endpoints
- [ ] 8.3 Add inline code comments for complex logic (password hashing, token generation)
- [ ] 8.4 Update CLAUDE.md with new routes and components
