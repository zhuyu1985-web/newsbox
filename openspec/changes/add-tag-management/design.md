# Technical Design: Add Tag Management

## Overview

This design document details the implementation of a comprehensive tag management system with hierarchical organization, custom sorting, and full CRUD operations. The tag management page will be the second primary navigation item in the dashboard.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Dashboard Layout                         │
├──────────┬──────────────────┬───────────────────────────────┤
│ Primary  │   Secondary Nav  │      Main Content Area        │
│   Nav    │  (Tag Tree)      │   (Tag-Filtered Notes)        │
│          │                  │                               │
│ [收藏]   │  标签 [+]        │  ┌─────────────────────────┐ │
│ [标签]   │  ├─ Work (5)     │  │ Search & Filters        │ │
│ [批注]   │  │  ├─ AI (3)    │  └─────────────────────────┘ │
│ [归档]   │  │  └─ Dev (2)   │  ┌─────────────────────────┐ │
│          │  ├─ Personal (8) │  │ Note List (Grid/List)   │ │
│          │  └─ Reading (12) │  │ - Note Card 1           │ │
│          │                  │  │ - Note Card 2           │ │
│          │  排序: [自定义▼] │  │ - Note Card 3           │ │
│          │                  │  │ ...                     │ │
│          │                  │  └─────────────────────────┘ │
└──────────┴──────────────────┴───────────────────────────────┘
```

## Database Schema Changes

### 1. Extend `tags` Table

```sql
-- Add new columns to support hierarchy and organization
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Drop existing unique constraint
ALTER TABLE public.tags
  DROP CONSTRAINT IF EXISTS tags_user_id_name_unique;

-- Create new unique constraint allowing same names under different parents
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_parent_name_active
  ON public.tags(user_id, COALESCE(parent_id::text, 'root'), name)
  WHERE archived_at IS NULL;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tags_user_parent ON public.tags(user_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_position ON public.tags(user_id, position);
CREATE INDEX IF NOT EXISTS idx_tags_user_archived ON public.tags(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_tags_parent_position ON public.tags(parent_id, position);

-- Add check constraint to prevent self-referencing
ALTER TABLE public.tags
  ADD CONSTRAINT tags_no_self_reference CHECK (id != parent_id);
```

### 2. Data Model

```typescript
interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
}

interface TagWithCount extends Tag {
  note_count: number;
  children: TagWithCount[];
}

interface TagTreeNode extends TagWithCount {
  children: TagTreeNode[];
  expanded?: boolean;
}
```

## API Design

### Tag Endpoints

#### 1. Get Tag Hierarchy
```
GET /api/tags?include_archived=false&include_counts=true
Response: TagWithCount[]
```

Fetches all tags for the current user in a flat list with parent_id relationships. Frontend will build the tree structure.

```typescript
// Supabase query
const { data: tags } = await supabase
  .from('tags')
  .select(`
    *,
    notes:note_tags(count)
  `)
  .eq('user_id', userId)
  .is('archived_at', null)
  .order('position', { ascending: true });
```

#### 2. Create Tag
```
POST /api/tags
Body: {
  name: string;
  color?: string;
  icon?: string;
  parent_id?: string;
}
Response: Tag
```

Validation:
- Check for duplicate name under same parent
- Validate parent_id exists and belongs to user
- Auto-assign position as max(position) + 1 for siblings

#### 3. Update Tag
```
PATCH /api/tags/:id
Body: {
  name?: string;
  color?: string;
  icon?: string;
  parent_id?: string;
}
Response: Tag
```

Validation:
- Check for circular references when changing parent_id
- Validate new name is unique under target parent
- Prevent moving to own descendant

#### 4. Delete Tag
```
DELETE /api/tags/:id?force=false
Response: { success: boolean; message?: string }
```

Validation:
- If tag has children, require force=true or block deletion
- If tag has notes, either:
  - Block deletion (recommended)
  - Remove associations (if force=true)
  - Move notes to parent tag (if force=true and parent exists)

#### 5. Reorder Tags
```
POST /api/tags/reorder
Body: {
  tag_id: string;
  new_position: number;
  new_parent_id?: string;
}
Response: { success: boolean }
```

Updates position values for affected tags to maintain order.

#### 6. Archive Tag
```
POST /api/tags/:id/archive
Response: Tag
```

Soft delete by setting `archived_at`. Archived tags and their children are hidden from default views.

## Frontend Implementation

### 1. State Management

```typescript
// In dashboard-content.tsx
const [activePrimary, setActivePrimary] = useState<PrimaryNav>("collections");
const [selectedTag, setSelectedTag] = useState<string | null>(null);
const [tags, setTags] = useState<TagWithCount[]>([]);
const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);
const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
const [tagSortMode, setTagSortMode] = useState<"custom" | "name-asc" | "name-desc">("custom");
```

### 2. Tag Tree Rendering

```typescript
// Build tree from flat list
function buildTagTree(tags: TagWithCount[]): TagTreeNode[] {
  const tagMap = new Map<string, TagTreeNode>();
  const roots: TagTreeNode[] = [];

  // Create nodes
  tags.forEach(tag => {
    tagMap.set(tag.id, { ...tag, children: [], expanded: expandedTags.has(tag.id) });
  });

  // Build hierarchy
  tags.forEach(tag => {
    const node = tagMap.get(tag.id)!;
    if (tag.parent_id) {
      const parent = tagMap.get(tag.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // Orphaned tag
      }
    } else {
      roots.push(node);
    }
  });

  // Sort based on mode
  const sortFn = getSortFunction(tagSortMode);
  sortTree(roots, sortFn);

  return roots;
}

function sortTree(nodes: TagTreeNode[], sortFn: (a: TagTreeNode, b: TagTreeNode) => number) {
  nodes.sort(sortFn);
  nodes.forEach(node => {
    if (node.children.length > 0) {
      sortTree(node.children, sortFn);
    }
  });
}

function getSortFunction(mode: string) {
  switch (mode) {
    case "name-asc":
      return (a: TagTreeNode, b: TagTreeNode) => a.name.localeCompare(b.name);
    case "name-desc":
      return (a: TagTreeNode, b: TagTreeNode) => b.name.localeCompare(a.name);
    case "custom":
    default:
      return (a: TagTreeNode, b: TagTreeNode) => a.position - b.position;
  }
}
```

### 3. Tag Tree Component

```typescript
function TagTreeItem({ 
  tag, 
  level = 0, 
  onSelect, 
  onExpand, 
  onAction 
}: TagTreeItemProps) {
  const hasChildren = tag.children.length > 0;
  
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent",
          selectedTag === tag.id && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(tag.id);
            }}
          >
            {tag.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}
        {!hasChildren && <div className="w-4" />}
        
        <div
          className="flex-1 flex items-center gap-2 min-w-0"
          onClick={() => onSelect(tag.id)}
        >
          {tag.icon ? (
            <span className="text-sm">{tag.icon}</span>
          ) : (
            <Tag className="h-3.5 w-3.5 flex-shrink-0" style={{ color: tag.color || undefined }} />
          )}
          <span className="text-xs truncate">{tag.name}</span>
          <span className="text-xs text-muted-foreground ml-auto">({tag.note_count})</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction('rename', tag)}>
              <Pencil className="mr-2 h-4 w-4" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('change-icon', tag)}>
              <Tag className="mr-2 h-4 w-4" />
              更换图标/颜色
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('create-child', tag)}>
              <Plus className="mr-2 h-4 w-4" />
              创建子标签
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('archive', tag)}>
              <Archive className="mr-2 h-4 w-4" />
              归档
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('delete', tag)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {tag.expanded && hasChildren && (
        <div>
          {tag.children.map(child => (
            <TagTreeItem
              key={child.id}
              tag={child}
              level={level + 1}
              onSelect={onSelect}
              onExpand={onExpand}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4. Drag-and-Drop Integration

Use `@dnd-kit/core` for drag-and-drop functionality:

```typescript
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';

function TagList() {
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    // Calculate new position and parent
    const draggedTag = findTagById(active.id as string);
    const targetTag = findTagById(over.id as string);
    
    // Call reorder API
    await reorderTag(draggedTag.id, targetTag.position, targetTag.parent_id);
    
    // Refresh tag list
    await loadTags();
  };
  
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tagTree.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tagTree.map(tag => (
          <SortableTagTreeItem key={tag.id} tag={tag} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### 5. Note Filtering by Tag

When a tag is selected, fetch notes that have that tag:

```typescript
async function fetchNotesByTag(tagId: string, includeChildren: boolean = true) {
  let tagIds = [tagId];
  
  if (includeChildren) {
    // Get all descendant tag IDs
    tagIds = [...tagIds, ...getDescendantTagIds(tagId)];
  }
  
  const { data: notes } = await supabase
    .from('notes')
    .select(`
      *,
      note_tags!inner(tag_id)
    `)
    .eq('user_id', userId)
    .in('note_tags.tag_id', tagIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  
  return notes;
}

function getDescendantTagIds(tagId: string): string[] {
  const descendants: string[] = [];
  const tag = findTagById(tagId);
  
  function traverse(node: TagTreeNode) {
    descendants.push(node.id);
    node.children.forEach(traverse);
  }
  
  tag?.children.forEach(traverse);
  return descendants;
}
```

## UI/UX Considerations

### 1. Visual Hierarchy
- Use indentation (16px per level) to show nesting
- Use chevron icons (▶/▼) for expand/collapse
- Highlight selected tag with accent background
- Show note count in muted color

### 2. Interaction Patterns
- Click tag name to select and filter notes
- Click chevron to expand/collapse children
- Hover to show "..." menu button
- Drag tag to reorder (show drop indicator)

### 3. Sorting Controls
```typescript
<div className="flex items-center gap-2 px-2 py-2">
  <span className="text-xs text-muted-foreground">排序:</span>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-7 text-xs">
        {tagSortMode === "custom" ? "自定义" : tagSortMode === "name-asc" ? "名称 A-Z" : "名称 Z-A"}
        <ChevronDown className="ml-1 h-3 w-3" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => setTagSortMode("custom")}>
        自定义排序
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTagSortMode("name-asc")}>
        按名称 A-Z
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTagSortMode("name-desc")}>
        按名称 Z-A
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

### 4. Tag Creation Dialog
- Simple form with name, color picker, icon selector (emoji or icon)
- Preview tag appearance
- Validate name uniqueness under parent
- Auto-focus name input

### 5. Tag Edit Dialog
- Same as creation dialog, pre-filled with current values
- Show warning if renaming will cause conflicts
- Allow changing parent (with circular reference check)

## Performance Optimization

### 1. Efficient Queries
- Use indexed columns for filtering and sorting
- Fetch tag counts in a single query using joins
- Cache tag tree in frontend state

### 2. Lazy Loading
- Load tag tree on mount
- Fetch notes only when tag is selected
- Use pagination for large note lists

### 3. Optimistic Updates
- Update UI immediately on user action
- Revert on API error
- Show loading states for async operations

## Error Handling

### 1. Circular Reference Detection
```typescript
function hasCircularReference(tagId: string, newParentId: string): boolean {
  let currentId: string | null = newParentId;
  
  while (currentId) {
    if (currentId === tagId) return true;
    const parent = findTagById(currentId);
    currentId = parent?.parent_id || null;
  }
  
  return false;
}
```

### 2. Validation Messages
- "标签名称已存在于当前层级"
- "无法将标签移动到其子标签下"
- "该标签下还有子标签，无法删除"
- "该标签下还有笔记，无法删除"

### 3. Graceful Degradation
- If tag tree fails to load, show error message with retry button
- If drag-and-drop fails, fall back to manual position input
- If note count query fails, show "?" instead of count

## Migration Strategy

### 1. Database Migration
- Run migration script to add new columns
- Backfill `position` based on `created_at` order
- No data loss for existing tags

### 2. Frontend Migration
- Update tag-related components to use new schema
- Add feature flag to toggle tag management page
- Test with existing production data

### 3. Rollback Plan
- Keep old tag queries as fallback
- Migration script includes rollback SQL
- Feature flag allows disabling new UI

## Testing Strategy

### 1. Unit Tests
- Tag tree building logic
- Circular reference detection
- Sort functions
- Descendant ID collection

### 2. Integration Tests
- Tag CRUD API endpoints
- Tag reordering
- Note filtering by tag
- Tag archiving and deletion

### 3. E2E Tests
- Create tag hierarchy
- Drag-and-drop reordering
- Select tag and view notes
- Edit and delete tags

## Security Considerations

### 1. Authorization
- All tag operations check `user_id` matches authenticated user
- RLS policies enforce row-level security
- Prevent accessing other users' tags

### 2. Validation
- Sanitize tag names (prevent XSS)
- Validate parent_id belongs to same user
- Limit tag name length (e.g., 100 chars)
- Limit nesting depth (e.g., 10 levels)

### 3. Rate Limiting
- Limit tag creation to prevent abuse (e.g., 100 tags per hour)
- Limit reorder operations (e.g., 50 per minute)

## Future Enhancements

1. **Tag Merging**: Combine two tags into one
2. **Tag Suggestions**: AI-powered tag recommendations
3. **Tag Templates**: Pre-defined tag hierarchies for common use cases
4. **Tag Analytics**: Show most-used tags, tag usage over time
5. **Tag Sharing**: Share tag taxonomies with other users
6. **Bulk Tag Operations**: Apply tags to multiple notes at once
7. **Tag Aliases**: Alternative names for the same tag
8. **Tag Descriptions**: Add notes/descriptions to tags

## Open Issues

1. **Include Children Toggle**: Should we add a UI toggle to include/exclude child tag notes?
   - **Decision**: Yes, add a toggle button in the main content area toolbar

2. **Drag-and-Drop Across Parents**: Should drag-and-drop allow moving tags between parents?
   - **Decision**: Yes, but show a confirmation dialog if tag has children

3. **Tag Color Inheritance**: Should child tags inherit parent colors by default?
   - **Decision**: No, each tag has independent color

4. **Archived Tag Visibility**: Should we show archived tags in a separate section?
   - **Decision**: Add "显示已归档" toggle in tag sidebar footer

