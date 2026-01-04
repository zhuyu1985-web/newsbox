# Change: Add Annotation Sharing with Password Protection

## Why

Users need a way to share specific highlights and annotations from articles/videos with others, not just entire notes. Current sharing functionality only supports sharing full note links. This feature enables selective sharing of valuable insights, quotes, and commentary while protecting sensitive content with password-based access control and expiration limits.

Key motivations:
- Share specific insights without exposing entire reading lists
- Control access to shared content with passwords and time limits
- Enable collaboration on specific passages and commentary
- Facilitate academic citation and research collaboration

## What Changes

- **Password-protected share links**: Generate unique share URLs with optional password protection and expiration dates
- **Annotation-specific sharing**: Allow users to share individual annotations or batches of highlights from a note
- **Share management UI**: Add interface in reader page to create, view, and manage shared annotation links
- **Public share view**: Create a minimal, unauthenticated view for displaying shared annotations with proper formatting
- **Access tracking**: Optional analytics to track when shared links are accessed (without PII)
- **Copy-friendly formatting**: Ensure shared annotations include proper citation information (source, author, date)

**BREAKING**: None - this is a net-new feature that extends existing sharing and annotations capabilities

## Impact

### Affected Specs
- **sharing**: Add new requirements for annotation-specific sharing, password protection, and expiration
- **annotations**: Extend to support sharing metadata and public visibility flags

### Affected Code
- Database:
  - New table: `shared_annotations` (share links, passwords, expiration, access logs)
  - Extend `annotations` table: add `is_shareable` boolean field
- Frontend:
  - `components/reader/RightSidebar/AnnotationList.tsx`: Add share button per annotation
  - `components/reader/GlobalHeader/`: Add "Share Highlights" action in header
  - New component: `components/sharing/SharedAnnotationView.tsx` (public view)
  - New component: `components/sharing/ShareAnnotationDialog.tsx` (create share link)
  - New page: `app/share/[shareId]/page.tsx` (public unauthenticated route)
- API:
  - New route: `app/api/share/annotations/route.ts` (create share link)
  - New route: `app/api/share/[shareId]/route.ts` (validate and fetch shared content)
  - New route: `app/api/share/[shareId]/access/route.ts` (verify password, log access)

### Migration Considerations
- Existing annotations are not shareable by default (`is_shareable = false`)
- Users must explicitly opt-in to share specific annotations
- Share links are scoped per-user to prevent unauthorized access to other users' annotations
