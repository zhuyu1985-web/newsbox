# Implementation Tasks

## 1. Database Schema & Optimization

- [ ] 1.1 Add indexes for timeline queries
  - [ ] Add index on `knowledge_relationships(user_id, created_at)`
  - [ ] Add index on `knowledge_note_entities(user_id, note_id)`
  - [ ] Add composite index on `knowledge_entities(user_id, name)` for deduplication
- [ ] 1.2 Add constraints for data integrity
  - [ ] Ensure `confidence_score` is between 0 and 1
  - [ ] Add check constraint for valid entity types
- [ ] 1.3 Create migration file and test locally

## 2. Entity Extraction Pipeline

- [ ] 2.1 Enhance `lib/services/knowledge-graph.ts`
  - [ ] Add entity deduplication function using cosine similarity
  - [ ] Implement stop-words filtering logic
  - [ ] Add entity name normalization (lowercase, trim)
  - [ ] Add alias merging when entities are deduplicated
- [ ] 2.2 Integrate extraction into capture flow
  - [ ] Modify `app/api/capture/route.ts` to trigger extraction
  - [ ] Implement background job queue (or use simple async call)
  - [ ] Add error handling and retry logic
  - [ ] Add logging for extraction success/failure
- [ ] 2.3 Create batch extraction endpoint
  - [ ] Create `app/api/knowledge/graph/extract-batch/route.ts`
  - [ ] Support processing multiple notes in one request
  - [ ] Add progress tracking and status reporting
  - [ ] Implement rate limiting to avoid API overload

## 3. Evidence Traceability System

- [ ] 3.1 Create EvidenceModal component
  - [ ] Create `components/dashboard/knowledge-graph/EvidenceModal.tsx`
  - [ ] Design modal layout (relationship header, evidence list, source links)
  - [ ] Implement evidence snippet display with highlighting
  - [ ] Add navigation to source notes
- [ ] 3.2 Implement edge click handler in KnowledgeGraphView
  - [ ] Add onClick handler for graph links
  - [ ] Fetch relationship evidence from database
  - [ ] Open EvidenceModal with relationship data
  - [ ] Handle loading and error states
- [ ] 3.3 Create API endpoint for relationship evidence
  - [ ] Create `app/api/knowledge/graph/relationships/[id]/evidence/route.ts`
  - [ ] Query all notes containing the relationship
  - [ ] Return evidence snippets with note metadata
  - [ ] Ensure user-scoped access control

## 4. Advanced Filtering UI

- [ ] 4.1 Enhance KnowledgeGraphView filtering controls
  - [ ] Add confidence score slider (0-1 range, default 0.5)
  - [ ] Add relationship type multi-select dropdown
  - [ ] Add "Show filtered entities" toggle for stop-words
  - [ ] Implement filter state management (React state or URL params)
- [ ] 4.2 Implement client-side filtering logic
  - [ ] Filter graph data based on confidence threshold
  - [ ] Filter by selected relationship types
  - [ ] Apply stop-words filtering to hide generic entities
  - [ ] Update graph visualization when filters change
- [ ] 4.3 Add filter summary display
  - [ ] Show count of visible vs total entities/relationships
  - [ ] Add "Clear all filters" button
  - [ ] Persist filter state in URL for sharing

## 5. Timeline Analysis Feature

- [ ] 5.1 Create TimelineControls component
  - [ ] Create `components/dashboard/knowledge-graph/TimelineControls.tsx`
  - [ ] Design timeline slider UI (date range selector)
  - [ ] Add play/pause button for animation
  - [ ] Add speed control for playback
- [ ] 5.2 Implement time-based graph filtering
  - [ ] Add date range state to KnowledgeGraphView
  - [ ] Filter relationships by `created_at` timestamp
  - [ ] Filter entities to only show those with relationships in range
  - [ ] Update graph when timeline changes
- [ ] 5.3 Implement timeline animation
  - [ ] Create animation loop that increments time
  - [ ] Highlight newly added relationships with pulse effect
  - [ ] Add smooth transitions for appearing/disappearing nodes
  - [ ] Implement pause/resume functionality
- [ ] 5.4 Optimize timeline query performance
  - [ ] Create API endpoint for time-range queries
  - [ ] Use database indexes for efficient filtering
  - [ ] Implement caching for frequently accessed time ranges
  - [ ] Add loading states during timeline queries

## 6. Entity Profile Enhancements

- [ ] 6.1 Add AI entity summary generation
  - [ ] Create function in `lib/services/openai.ts` for entity summaries
  - [ ] Fetch all notes mentioning the entity
  - [ ] Generate summary using LLM with context from notes
  - [ ] Cache generated summaries in database or memory
- [ ] 6.2 Enhance EntityProfilePanel component
  - [ ] Display AI-generated entity summary at top
  - [ ] Show evidence count for each relationship
  - [ ] Add mention timeline with clickable note links
  - [ ] Improve relationship list layout and readability
- [ ] 6.3 Create API endpoint for entity summaries
  - [ ] Create `app/api/knowledge/graph/entities/[id]/summary/route.ts`
  - [ ] Check for cached summary first
  - [ ] Generate new summary if not cached
  - [ ] Return summary with metadata (generation time, source count)

## 7. Stop-words Management

- [ ] 7.1 Create stop-words configuration
  - [ ] Create `lib/services/knowledge-graph-stopwords.ts`
  - [ ] Define list of generic Chinese entities (记者, 美国, 中国, 今天, 昨天, etc.)
  - [ ] Define list of generic English entities (reporter, today, yesterday, etc.)
  - [ ] Export function to check if entity is stop-word
- [ ] 7.2 Apply stop-words filtering in extraction
  - [ ] Filter out stop-word entities during extraction
  - [ ] Log filtered entities for debugging
  - [ ] Add option to disable stop-words filtering (for testing)

## 8. Testing & Quality Assurance

- [ ] 8.1 Test entity extraction pipeline
  - [ ] Test with various content types (news articles, blog posts, academic papers)
  - [ ] Verify entity deduplication accuracy
  - [ ] Test error handling for malformed content
  - [ ] Verify background processing doesn't block user
- [ ] 8.2 Test evidence traceability
  - [ ] Verify evidence modal displays correct snippets
  - [ ] Test navigation to source notes
  - [ ] Test with relationships from multiple sources
  - [ ] Verify user-scoped access control
- [ ] 8.3 Test filtering functionality
  - [ ] Test confidence score filtering at various thresholds
  - [ ] Test relationship type filtering with multiple selections
  - [ ] Test stop-words filtering toggle
  - [ ] Test combined filters
- [ ] 8.4 Test timeline analysis
  - [ ] Test timeline slider with various date ranges
  - [ ] Test animation playback (play/pause/speed)
  - [ ] Verify relationship timestamps are accurate
  - [ ] Test performance with large graphs (100+ entities)
- [ ] 8.5 Test entity profile enhancements
  - [ ] Verify AI summaries are relevant and accurate
  - [ ] Test summary caching behavior
  - [ ] Test mention timeline sorting and navigation
  - [ ] Verify evidence counts are correct

## 9. Performance Optimization

- [ ] 9.1 Optimize database queries
  - [ ] Add EXPLAIN ANALYZE to identify slow queries
  - [ ] Optimize timeline range queries with proper indexes
  - [ ] Implement query result caching where appropriate
  - [ ] Add pagination for large result sets
- [ ] 9.2 Optimize graph rendering
  - [ ] Implement node/edge culling for large graphs
  - [ ] Add level-of-detail (LOD) for labels at different zoom levels
  - [ ] Optimize force simulation parameters for faster convergence
  - [ ] Add virtualization for entity profile lists
- [ ] 9.3 Optimize LLM API calls
  - [ ] Implement request batching where possible
  - [ ] Add aggressive caching for entity summaries
  - [ ] Set appropriate token limits to control costs
  - [ ] Add rate limiting to prevent API quota exhaustion

## 10. Documentation & Polish

- [ ] 10.1 Update user-facing documentation
  - [ ] Add knowledge graph usage guide to help docs
  - [ ] Document filtering capabilities
  - [ ] Document timeline analysis feature
  - [ ] Add troubleshooting section
- [ ] 10.2 Add UI polish
  - [ ] Add loading skeletons for async operations
  - [ ] Add empty states for no entities/relationships
  - [ ] Add tooltips for all interactive elements
  - [ ] Ensure responsive design on mobile/tablet
- [ ] 10.3 Add error handling and user feedback
  - [ ] Add toast notifications for extraction success/failure
  - [ ] Add error boundaries for component crashes
  - [ ] Add retry mechanisms for failed operations
  - [ ] Add helpful error messages for common issues
