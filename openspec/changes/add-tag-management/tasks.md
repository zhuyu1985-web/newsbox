# Implementation Tasks: Add Tag Management

## Overview
This document outlines the implementation tasks for adding a comprehensive tag management system with hierarchical organization, custom sorting, and full CRUD operations.

## Task Groups

### Stage 1: Data Model & Database Migration (3 tasks)

#### Task 1.1: Create database migration script
- [ ] Create `006_add_tag_management.sql` migration file
- [ ] Add `parent_id` column (UUID, self-referencing FK to tags.id)
- [ ] Add `position` column (INTEGER, default 0) for custom ordering
- [ ] Add `icon` column (TEXT) for visual distinction
- [ ] Add `archived_at` column (TIMESTAMPTZ) for soft delete
- [ ] Drop existing `tags_user_id_name_unique` constraint
- [ ] Create new unique index `idx_tags_user_parent_name_active` allowing same names under different parents
- [ ] Add check constraint `tags_no_self_reference` to prevent self-referencing
- [ ] Add indexes: `idx_tags_user_parent`, `idx_tags_user_position`, `idx_tags_user_archived`, `idx_tags_parent_position`
- [ ] Backfill `position` for existing tags based on `created_at` order

**Validation**: Run migration in Supabase SQL Editor without errors; verify indexes created

#### Task 1.2: Update TypeScript types
- [ ] Extend `Tag` interface in types to include `parent_id`, `position`, `icon`, `archived_at`
- [ ] Create `TagWithCount` interface extending `Tag` with `note_count` and `children`
- [ ] Create `TagTreeNode` interface extending `TagWithCount` with `expanded` state
- [ ] Create `TagSortMode` type: `"custom" | "name-asc" | "name-desc"`

**Validation**: TypeScript compilation passes without errors

#### Task 1.3: Update Supabase RLS policies for tags
- [ ] Verify existing RLS policies on `tags` table allow hierarchical operations
- [ ] Add policy for reading tags with `archived_at IS NULL` by default
- [ ] Ensure policies check `user_id` for all CRUD operations

**Validation**: Test tag queries with different users; verify isolation

---

### Stage 2: Backend API Endpoints (5 tasks)

#### Task 2.1: Extend GET /api/tags endpoint
- [ ] Add query parameter `include_archived` (default: false)
- [ ] Add query parameter `include_counts` (default: true)
- [ ] Modify Supabase query to fetch tags with `parent_id`, `position`, `icon`, `archived_at`
- [ ] Join with `note_tags` to get note counts per tag
- [ ] Order by `position ASC` by default
- [ ] Filter out archived tags unless `include_archived=true`

**Validation**: GET /api/tags returns flat list with hierarchy fields and note counts

#### Task 2.2: Update POST /api/tags endpoint
- [ ] Add `parent_id` to request body (optional)
- [ ] Add `icon` to request body (optional)
- [ ] Validate `parent_id` exists and belongs to user (if provided)
- [ ] Check for duplicate name under same parent (not globally)
- [ ] Auto-assign `position` as `max(position) + 1` for siblings under same parent
- [ ] Return created tag with all fields

**Validation**: Create root tag and child tag; verify parent-child relationship

#### Task 2.3: Update PATCH /api/tags/:id endpoint
- [ ] Allow updating `name`, `color`, `icon`, `parent_id`
- [ ] Validate new name is unique under target parent
- [ ] Implement circular reference detection when changing `parent_id`
- [ ] Prevent moving tag to its own descendant
- [ ] Return updated tag

**Validation**: Rename tag, change parent; verify circular reference blocked

#### Task 2.4: Create POST /api/tags/reorder endpoint
- [ ] Accept `tag_id`, `new_position`, `new_parent_id` (optional)
- [ ] Validate tag belongs to user
- [ ] If `new_parent_id` provided, validate it exists and no circular reference
- [ ] Update `position` for affected sibling tags to maintain order
- [ ] Update `parent_id` if moving between parents
- [ ] Return success response

**Validation**: Drag-and-drop reorder; verify positions updated correctly

#### Task 2.5: Create POST /api/tags/:id/archive endpoint
- [ ] Set `archived_at` to current timestamp
- [ ] Optionally cascade to child tags (or block if has children)
- [ ] Return archived tag

**Validation**: Archive tag; verify hidden from default views

---

### Stage 3: Frontend State Management (4 tasks)

#### Task 3.1: Add tag management state to dashboard-content.tsx
- [ ] Add `selectedTag` state (string | null)
- [ ] Add `tags` state (TagWithCount[])
- [ ] Add `tagTree` state (TagTreeNode[])
- [ ] Add `expandedTags` state (Set<string>)
- [ ] Add `tagSortMode` state (TagSortMode, default: "custom")
- [ ] Add `includeChildTags` state (boolean, default: true)

**Validation**: State initializes correctly on mount

#### Task 3.2: Implement tag tree building logic
- [ ] Create `buildTagTree(tags: TagWithCount[]): TagTreeNode[]` function
- [ ] Map tags by ID for efficient lookup
- [ ] Build parent-child relationships
- [ ] Handle orphaned tags (parent not found)
- [ ] Apply sorting based on `tagSortMode`
- [ ] Recursively sort children

**Validation**: Flat tag list correctly transforms to tree structure

#### Task 3.3: Implement tag data fetching
- [ ] Create `loadTags()` function to fetch tags from API
- [ ] Call on component mount and after tag operations
- [ ] Build tag tree from fetched data
- [ ] Handle loading and error states

**Validation**: Tags load on page load; tree renders correctly

#### Task 3.4: Implement tag-based note filtering
- [ ] Create `fetchNotesByTag(tagId: string)` function
- [ ] Get descendant tag IDs if `includeChildTags` is true
- [ ] Query notes with `note_tags.tag_id IN (tagIds)`
- [ ] Support pagination with existing infinite scroll logic
- [ ] Reset pagination when tag selection changes

**Validation**: Selecting tag filters notes correctly; child tags included/excluded based on toggle

---

### Stage 4: Tag Management UI (6 tasks)

#### Task 4.1: Add "标签" primary navigation item
- [ ] Add "标签" to `PrimaryNav` type
- [ ] Add tag icon to primary navigation sidebar
- [ ] Update `activePrimary` state handling
- [ ] Persist selected primary nav to localStorage

**Validation**: Click "标签" switches to tag management view

#### Task 4.2: Create TagTreeItem component
- [ ] Render tag with icon/color, name, note count
- [ ] Show expand/collapse chevron for tags with children
- [ ] Apply indentation based on nesting level (16px per level)
- [ ] Highlight selected tag
- [ ] Show "..." menu button on hover
- [ ] Handle click to select tag
- [ ] Handle chevron click to expand/collapse

**Validation**: Tag tree renders with proper hierarchy and interactions

#### Task 4.3: Implement tag context menu ("..." actions)
- [ ] Add dropdown menu with options: 重命名, 更换图标/颜色, 创建子标签, 归档, 删除
- [ ] Handle "重命名" action (open dialog)
- [ ] Handle "更换图标/颜色" action (open dialog)
- [ ] Handle "创建子标签" action (open dialog with parent pre-filled)
- [ ] Handle "归档" action (confirm and archive)
- [ ] Handle "删除" action (validate and delete)

**Validation**: All menu actions work correctly; validation prevents invalid operations

#### Task 4.4: Create tag creation/edit dialog
- [ ] Create reusable dialog component for create/edit
- [ ] Add name input (required)
- [ ] Add color picker (optional, default: null)
- [ ] Add icon selector (emoji or icon library, optional)
- [ ] Add parent selector (for create, optional)
- [ ] Show preview of tag appearance
- [ ] Validate name uniqueness under parent
- [ ] Call API on submit
- [ ] Refresh tag list on success

**Validation**: Create root tag, child tag, edit tag; verify all fields work

#### Task 4.5: Add tag sorting controls
- [ ] Add sorting dropdown in secondary nav below tag list
- [ ] Options: "自定义排序", "按名称 A-Z", "按名称 Z-A"
- [ ] Update `tagSortMode` state on selection
- [ ] Rebuild tag tree with new sort order
- [ ] Persist sort preference to localStorage

**Validation**: Switch sort modes; verify tree reorders correctly

#### Task 4.6: Add "+" button for tag creation
- [ ] Add "+" button next to "标签" heading in secondary nav
- [ ] Click opens tag creation dialog
- [ ] Default to root tag (no parent)

**Validation**: Click "+" opens dialog; create tag successfully

---

### Stage 5: Drag-and-Drop Sorting (4 tasks)

#### Task 5.1: Install and configure @dnd-kit
- [ ] Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [ ] Wrap tag list with `DndContext`
- [ ] Configure collision detection (closestCenter)

**Validation**: Package installed; no build errors

#### Task 5.2: Make TagTreeItem draggable
- [ ] Wrap TagTreeItem with `useSortable` hook
- [ ] Add drag handle (entire item or specific icon)
- [ ] Show drag overlay during drag
- [ ] Apply drag styles (opacity, cursor)

**Validation**: Tags are draggable; visual feedback works

#### Task 5.3: Implement drop logic
- [ ] Handle `onDragEnd` event
- [ ] Calculate new position based on drop target
- [ ] Determine new parent if dropped on different parent
- [ ] Call `/api/tags/reorder` endpoint
- [ ] Refresh tag list on success
- [ ] Show error if reorder fails

**Validation**: Drag-and-drop reorders tags; positions persist after refresh

#### Task 5.4: Prevent invalid drops
- [ ] Block dropping tag on its own descendant (circular reference)
- [ ] Show visual indicator for invalid drop targets
- [ ] Display error message if user attempts invalid drop

**Validation**: Cannot create circular references via drag-and-drop

---

### Stage 6: Main Content Area Integration (3 tasks)

#### Task 6.1: Update note list rendering for tag view
- [ ] Reuse existing note list components (grid/list views)
- [ ] Pass `selectedTag` to note fetching logic
- [ ] Show "选择标签以查看笔记" message when no tag selected
- [ ] Display tag name in content area header

**Validation**: Selecting tag shows filtered notes; deselecting shows prompt

#### Task 6.2: Add "包含子标签" toggle
- [ ] Add toggle button in main content area toolbar
- [ ] Update `includeChildTags` state on toggle
- [ ] Re-fetch notes when toggle changes
- [ ] Persist preference to localStorage

**Validation**: Toggle includes/excludes child tag notes correctly

#### Task 6.3: Support all existing note operations in tag view
- [ ] Verify star, move, archive, delete work in tag view
- [ ] Verify bulk actions work in tag view
- [ ] Verify filtering, sorting, view modes work in tag view

**Validation**: All note operations function identically to collections view

---

### Stage 7: Error Handling & Validation (3 tasks)

#### Task 7.1: Implement circular reference detection
- [ ] Create `hasCircularReference(tagId, newParentId)` utility function
- [ ] Traverse parent chain to detect cycles
- [ ] Call before updating `parent_id`
- [ ] Show user-friendly error message

**Validation**: Cannot create circular references; error message clear

#### Task 7.2: Add validation for tag deletion
- [ ] Check if tag has children before delete
- [ ] Check if tag has associated notes before delete
- [ ] Show confirmation dialog with details
- [ ] Offer to move notes to parent or remove associations (if force delete)

**Validation**: Cannot delete tag with children/notes without confirmation

#### Task 7.3: Handle API errors gracefully
- [ ] Show toast notifications for API errors
- [ ] Revert optimistic updates on failure
- [ ] Provide retry mechanism for failed operations
- [ ] Log errors for debugging

**Validation**: API errors don't crash UI; user gets feedback

---

### Stage 8: Testing & Documentation (3 tasks)

#### Task 8.1: Manual testing
- [ ] Test creating root tags and nested tags (3+ levels)
- [ ] Test renaming, changing icon/color
- [ ] Test drag-and-drop reordering within same level and across parents
- [ ] Test archiving and deleting tags
- [ ] Test filtering notes by tag (with and without child tags)
- [ ] Test all sorting modes
- [ ] Test with large number of tags (100+)
- [ ] Test circular reference prevention
- [ ] Test validation messages

**Validation**: All features work as expected; no console errors

#### Task 8.2: Update README and Supabase docs
- [ ] Add migration instructions for `006_add_tag_management.sql`
- [ ] Document new tag management features
- [ ] Add screenshots/GIFs of tag management UI

**Validation**: Documentation is clear and complete

#### Task 8.3: Validate with openspec
- [ ] Run `openspec validate add-tag-management --strict`
- [ ] Resolve any validation errors
- [ ] Ensure all requirements have scenarios
- [ ] Ensure all scenarios are testable

**Validation**: `openspec validate` passes with no errors

---

## Summary

**Total Tasks**: 31 tasks across 8 stages

**Estimated Effort**:
- Stage 1: 4 hours
- Stage 2: 6 hours
- Stage 3: 4 hours
- Stage 4: 8 hours
- Stage 5: 6 hours
- Stage 6: 4 hours
- Stage 7: 3 hours
- Stage 8: 3 hours

**Total**: ~38 hours

**Dependencies**:
- Stages 1-2 can be done in parallel (database + API)
- Stage 3 depends on Stage 2 (API must exist)
- Stage 4 depends on Stage 3 (state management must exist)
- Stage 5 depends on Stage 4 (UI must exist)
- Stage 6 depends on Stages 3-4 (state + UI must exist)
- Stage 7 can be done in parallel with Stages 5-6
- Stage 8 must be done last

**Critical Path**: Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Stage 8

