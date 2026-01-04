# Design: Annotation Sharing with Password Protection

## Context

The annotation sharing feature introduces a new access pattern: **unauthenticated public access to user-generated content** with optional password protection. This is the first feature that exposes user content outside the authenticated session boundary, requiring careful security design.

Key constraints:
- **Privacy-first**: Annotations are private by default; users must explicitly opt-in to share
- **Supabase RLS**: Must work within Supabase Row Level Security while allowing public reads
- **No PII in analytics**: Access logging must not store IP addresses or user agents
- **Minimal attack surface**: Share tokens must be cryptographically secure and unpredictable

Stakeholders:
- Users sharing research/citations
- Recipients accessing shared content (may not have accounts)
- System security and performance

## Goals / Non-Goals

### Goals
- Secure, password-protected sharing of annotations
- Minimal friction for recipients (no account required)
- Revocable and expirable share links
- Simple access analytics (view count, last accessed)
- Support batch sharing (multiple annotations in one link)

### Non-Goals
- Real-time collaboration (commenting, live updates)
- Granular permissions (view/edit/comment roles)
- Social features (likes, resharing)
- Advanced analytics (heatmaps, user profiles)
- Email notifications for share access

## Decisions

### Decision 1: Share Token Structure
**Choice**: Use cryptographically random 12-character alphanumeric tokens (e.g., `a3bK9mP2xQ5z`)

**Rationale**:
- 12 characters = 72 bits of entropy (62^12 ≈ 3.2×10^21 combinations) → brute-force resistant
- Alphanumeric only → URL-safe without encoding
- Short enough for manual sharing if needed
- Collision probability negligible (< 1 in 10^12 for 1M shares)

**Alternatives considered**:
- UUIDs: Too long (36 chars), less user-friendly
- Sequential IDs: Predictable, enables enumeration attacks
- Hash of annotation IDs: Leaks information about content structure

### Decision 2: Password Storage
**Choice**: Use bcrypt with 12 salt rounds, store only hash in database

**Rationale**:
- Industry standard for password hashing
- Adaptive work factor (can increase rounds over time)
- Salt included in hash output (no separate salt column needed)
- 12 rounds = ~250ms hashing time (acceptable for share access, prevents brute force)

**Alternatives considered**:
- Argon2: More secure but requires additional dependencies
- Plaintext comparison: Unacceptable security risk
- Client-side only password: No server-side verification, easily bypassed

### Decision 3: RLS Policy for Public Access
**Choice**: Create special RLS policy allowing public SELECT on `shared_annotations` table when `is_active = true AND (expires_at IS NULL OR expires_at > NOW())`

**Rationale**:
- Leverages Supabase's built-in RLS for access control
- No need for service role client (security best practice)
- Automatic filtering of expired/revoked shares
- Annotations table remains fully protected (only referenced IDs exposed)

**Implementation**:
```sql
CREATE POLICY "Public can view active shares"
  ON shared_annotations FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));
```

**Alternatives considered**:
- API-only access (no RLS): Bypasses Supabase security model, increases attack surface
- Service role client: Requires careful query construction, more error-prone

### Decision 4: Annotation Array vs Junction Table
**Choice**: Store annotation IDs as PostgreSQL array (`annotation_ids UUID[]`) in `shared_annotations` table

**Rationale**:
- Typical share link contains 1-10 annotations (array size reasonable)
- Simplifies queries (no JOIN needed to fetch annotation list)
- Easier to maintain ordering (array preserves insertion order)
- Fewer rows in database (one row per share vs one row per annotation-share pair)

**Trade-offs**:
- Cannot easily query "which shares contain annotation X" (acceptable - rare use case)
- Array size limit (8KB per row) caps max annotations per share (~500 UUIDs - far exceeds UI limit of 50)

**Alternatives considered**:
- Junction table (`shared_annotation_items`): More normalized but adds complexity for minimal benefit
- JSON array: Less type-safe, harder to query with array operators

### Decision 5: Access Logging Strategy
**Choice**: Optional separate table `shared_annotation_access_logs` with only non-PII data (timestamp, country/region code)

**Rationale**:
- Privacy compliance (GDPR, CCPA) - no IP addresses or user agents stored
- Minimal storage footprint
- Can aggregate by country/region for geographic insights
- Easy to disable entirely if not needed

**Implementation**:
- Use Cloudflare geolocation headers or similar (if available)
- Store only 2-letter country code + region
- Purge logs older than 90 days (automated cleanup job)

**Alternatives considered**:
- Full access logs with IP: Privacy concerns, regulatory risk
- No logging at all: Users want basic view count for academic citations
- Real-time analytics: Over-engineering for MVP

### Decision 6: Rate Limiting
**Choice**: Implement rate limits at API route level using IP-based tracking (in-memory or Redis)

**Limits**:
- Share creation: 10 per user per hour
- Password attempts: 5 per share token per 15 minutes
- Access logging: 1 per token per minute (prevent spam)

**Rationale**:
- Prevents abuse (spam share links, brute force attacks)
- Protects database from excessive writes
- Simple to implement with existing middleware patterns

**Alternatives considered**:
- Cloudflare rate limiting: Requires Cloudflare plan, adds external dependency
- No rate limiting: Exposes system to abuse
- Per-user global limit: Too restrictive for legitimate batch sharing use cases

## Risks / Trade-offs

### Risk 1: Exposed share tokens enable enumeration
**Mitigation**:
- 72-bit entropy makes brute force infeasible
- No sequential IDs or predictable patterns
- Monitor for suspicious access patterns (many 404s)

### Risk 2: Password-protected shares vulnerable to brute force
**Mitigation**:
- Rate limit: 5 attempts per 15 minutes per token
- Bcrypt's slow hashing adds cost per attempt
- Consider adding exponential backoff after failures

### Risk 3: Users accidentally share sensitive annotations
**Mitigation**:
- Annotations private by default (`is_shareable = false`)
- Confirmation dialog when creating share without password
- Clear UI indicators for shareable annotations
- Easy revocation mechanism

### Risk 4: Database growth from access logs
**Mitigation**:
- Make access logging optional (disable by default for MVP)
- Automated cleanup job (delete logs > 90 days)
- Consider aggregating to daily summaries after 7 days

### Risk 5: Deleted annotations break share links
**Mitigation**:
- Soft delete on annotations (keep data, hide from user)
- Share view gracefully handles missing annotations (skip and log error)
- Display warning to user: "1 of 3 annotations no longer available"

## Migration Plan

### Phase 1: Database Schema (Can run immediately)
1. Create migration `009_add_shared_annotations.sql`
2. Run on development environment first
3. Test RLS policies with public client
4. Run on production during low-traffic window

### Phase 2: API Routes (Behind feature flag)
1. Deploy API routes with feature flag disabled
2. Test with integration tests
3. Enable for internal testing users
4. Gradual rollout (10% → 50% → 100%)

### Phase 3: Frontend UI (Phased rollout)
1. Deploy share dialog component (hidden behind feature flag)
2. Enable for beta testers
3. Monitor error rates and user feedback
4. Full release

### Rollback Plan
- Feature flag can disable all sharing UI/API instantly
- Database tables can remain (no data loss)
- If critical security issue: revoke all shares with SQL: `UPDATE shared_annotations SET is_active = false`

## Data Migration
- Existing annotations: No migration needed (`is_shareable` defaults to `false`)
- No data loss risk
- No user action required

## Open Questions

1. **Should we support share link editing (change password/expiration)?**
   - **Decision**: Yes - include PATCH endpoint for `password_hash` and `expires_at` only
   - Keeps same share token (URL doesn't change)

2. **Maximum expiration duration?**
   - **Decision**: 1 year from creation
   - Academic citations typically need 6-12 months
   - Prevents indefinite exposure

3. **Should creators see who accessed their shares?**
   - **Decision**: No - only aggregate metrics (view count, last accessed time, country distribution)
   - Privacy concern for recipients
   - Avoids identity tracking implications

4. **How to handle annotations from deleted notes?**
   - **Decision**: Keep annotation data (soft delete on notes), share continues to work
   - Alternative: Cascade delete shares when note deleted (more disruptive)
   - **Choice**: Preserve shares, add UI indicator if source note deleted

5. **Support for public (no-password) shares?**
   - **Decision**: Yes - password is optional
   - Use case: Academic citations, public blog references
   - Confirmation dialog warns user before creating public share
