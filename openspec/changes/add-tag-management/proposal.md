# Proposal: Add Tag Management

## Why

Users need a comprehensive tag management system to organize and categorize their notes effectively. While the current system supports basic tag creation and assignment, it lacks:

1. **Dedicated Management Interface**: No centralized place to view, organize, and manage all tags
2. **Hierarchical Organization**: Cannot create parent-child tag relationships for better taxonomy
3. **Custom Ordering**: Cannot prioritize or reorder tags based on importance or usage
4. **Efficient Navigation**: Cannot quickly filter notes by tags with a dedicated view

As users accumulate more notes and tags, the lack of these features makes tag management increasingly difficult and time-consuming. A dedicated tag management page with hierarchical support and custom sorting will significantly improve user productivity and content organization.

## Problem Statement

Currently, the system supports basic tag creation and assignment to notes through the library view, but lacks a dedicated tag management interface. Users need a comprehensive tag management page as the second primary navigation item that allows them to:

1. View all tags in an organized manner
2. Create, edit, and delete tags with full CRUD operations
3. Organize tags hierarchically with multi-level nesting (similar to folder structure)
4. Sort tags by custom order (via drag-and-drop) or alphabetically by name
5. View notes associated with each tag in the main content area (consistent with the collections view)

Without a dedicated tag management interface, users cannot efficiently organize and maintain their tag taxonomy, especially as the number of tags grows.

## Proposed Solution

Add a new "标签管理" (Tag Management) primary navigation item that provides:

### 1. Tag Management Sidebar (Secondary Navigation)
- Display all user tags in a hierarchical tree structure
- Support multi-level tag nesting (parent-child relationships)
- Show note count for each tag
- Provide tag creation via "+" button next to "标签" heading
- Support tag expansion/collapse for nested tags
- Enable tag selection to filter notes in the main content area

### 2. Tag CRUD Operations
- **Create**: Add new root tags or child tags via "+" button or parent tag context menu
- **Read**: Display tag list with hierarchy, icons, colors, and note counts
- **Update**: Rename tags, change color/icon via "..." context menu
- **Delete**: Remove tags (with validation for tags that have notes or children)

### 3. Tag Sorting
- **Custom Order**: Drag-and-drop to reorder tags at the same level
- **Alphabetical Sort**: Sort by name A-Z or Z-A via toolbar button
- Persist sort preference per user

### 4. Main Content Area Integration
- When a tag is selected, display all notes with that tag in the main content area
- Reuse existing note list rendering, filtering, sorting, and view mode components
- Support all existing note operations (star, move, archive, delete, bulk actions)

### 5. Tag Hierarchy Support
- Extend `tags` table with `parent_id` and `position` columns
- Support unlimited nesting depth (though UI may limit practical depth)
- When a parent tag is selected, optionally show notes from child tags as well

## Scope

### In Scope
- Database schema changes for hierarchical tags
- Tag management UI in secondary navigation
- Tag CRUD operations with validation
- Drag-and-drop custom sorting
- Alphabetical sorting
- Tag-based note filtering in main content area
- Tag context menu ("..." actions)

### Out of Scope
- Tag merging or bulk tag operations (can be added later)
- Tag suggestions or auto-tagging (AI-based)
- Tag sharing or collaborative tagging
- Tag color themes or advanced styling options beyond basic color picker
- Tag analytics or usage statistics

## User Impact

### Benefits
- Centralized tag management improves organization and discoverability
- Hierarchical tags enable better taxonomy and categorization
- Custom sorting allows users to prioritize important tags
- Consistent UI patterns (similar to folder management) reduce learning curve
- Enhanced productivity for users with large tag collections

### Risks
- Migration complexity if users have many existing tags
- Performance considerations for deeply nested tag hierarchies
- Potential confusion between folders and tags (need clear UI distinction)

## Technical Considerations

### Database Changes
- Add `parent_id` (UUID, self-referencing FK) to `tags` table
- Add `position` (INTEGER) to `tags` table for custom ordering
- Add `icon` (TEXT) to `tags` table for visual distinction
- Add `archived_at` (TIMESTAMPTZ) to `tags` table for soft delete
- Update unique constraint to allow same tag names under different parents
- Add indexes for efficient hierarchy queries

### API Changes
- Extend tag API endpoints to support hierarchical queries
- Add endpoints for tag reordering
- Add validation for circular references in parent-child relationships
- Support recursive tag queries for note filtering (include child tags)

### Frontend Changes
- Add "tags" primary navigation item
- Implement tag tree rendering with expand/collapse
- Integrate drag-and-drop library (e.g., `@dnd-kit/core`)
- Add tag creation/edit dialogs
- Reuse existing note list components for tag-filtered views
- Add tag sorting toolbar controls

### Performance
- Implement efficient recursive queries for tag hierarchies
- Consider caching tag trees in frontend state
- Optimize note queries when filtering by tags with children

## Alternatives Considered

### Flat Tag List (No Hierarchy)
- **Pros**: Simpler implementation, no circular reference concerns
- **Cons**: Doesn't scale well for users with many tags, limited organization

### Tag Groups Instead of Hierarchy
- **Pros**: Simpler mental model, no nesting complexity
- **Cons**: Less flexible, doesn't match folder management patterns

### Combined Folder-Tag Management
- **Pros**: Single interface for all organization
- **Cons**: Confuses two distinct concepts, harder to understand

## Success Criteria

1. Users can create, edit, and delete tags from the tag management page
2. Users can organize tags into multi-level hierarchies
3. Users can reorder tags via drag-and-drop or alphabetical sort
4. Selecting a tag displays all associated notes in the main content area
5. Tag operations are performant (< 500ms for most actions)
6. No data loss during migration of existing tags
7. UI is consistent with existing folder management patterns

## Open Questions

1. Should selecting a parent tag show notes from all child tags, or only notes directly tagged with the parent?
   - **Recommendation**: Provide a toggle option in the UI (default: include children)

2. What is the maximum practical depth for tag nesting?
   - **Recommendation**: No hard limit in DB, but UI should warn after 5 levels

3. Should we support tag colors and icons like folders?
   - **Recommendation**: Yes, for consistency with folder management

4. How should we handle tags when notes are deleted?
   - **Recommendation**: Keep tags (they may be reused), just remove the association

5. Should drag-and-drop allow moving tags between parents?
   - **Recommendation**: Yes, but validate to prevent circular references

## Next Steps

1. Review and approve this proposal
2. Create detailed technical design document
3. Draft spec deltas for `dashboard` and `library` capabilities
4. Break down implementation into tasks
5. Validate with `openspec validate add-tag-management --strict`
6. Proceed to implementation phase

