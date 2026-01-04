# Technical Design: Fix Tag Realtime Updates

**Change ID**: `fix-tag-realtime-updates`  
**Status**: Draft  
**Created**: 2025-12-25

---

## Overview

本设计文档描述如何修复标签管理功能中的实时更新问题和无标签笔记计数问题。

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  DashboardContent Component                                  │
│  ├─ refreshAll()          ← 添加 loadTags() 调用            │
│  ├─ loadMetadata()        ← 添加 count_untagged_notes() 调用│
│  ├─ fetchNotes()          ← 添加无标签筛选逻辑              │
│  └─ UI Rendering          ← 显示 counts.untagged            │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  ├─ notes                                                    │
│  ├─ tags                                                     │
│  └─ note_tags (junction table)                              │
│                                                              │
│  RPC Functions:                                              │
│  └─ count_untagged_notes() ← 新增                           │
│     └─ 使用 NOT EXISTS 子查询统计无标签笔记                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### Migration: 007_add_count_untagged_notes_function.sql

#### RPC Function

```sql
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
```

**设计决策**：
- **SECURITY DEFINER**: 确保函数以定义者权限执行，访问 `auth.uid()`
- **STABLE**: 标记为稳定函数，优化查询计划缓存
- **NOT EXISTS**: 比 `NOT IN` 更高效，支持 NULL 值，利用索引
- **返回 INTEGER**: 明确类型，避免类型转换开销

#### Permissions

```sql
GRANT EXECUTE ON FUNCTION public.count_untagged_notes() TO authenticated;
```

---

## Frontend Changes

### 1. Type Definitions

#### Counts Interface

```typescript
interface Counts {
  uncategorized: number;
  all: number;
  starred: number;
  today: number;
  untagged: number; // ← 新增
}
```

### 2. State Management

#### Initial State

```typescript
const [counts, setCounts] = useState<Counts>({
  uncategorized: 0,
  all: 0,
  starred: 0,
  today: 0,
  untagged: 0, // ← 新增
});
```

### 3. Data Loading

#### refreshAll() 函数

**Before**:
```typescript
const refreshAll = async () => {
  await Promise.all([fetchNotes(0, false), loadMetadata()]);
  clearSelections();
};
```

**After**:
```typescript
const refreshAll = async () => {
  await Promise.all([fetchNotes(0, false), loadMetadata(), loadTags()]); // ← 添加 loadTags()
  clearSelections();
};
```

**影响**：
- 给笔记打标签后，调用 `refreshAll()` 会同时刷新标签列表
- 标签的笔记数量会实时更新

#### loadMetadata() 函数

**Before**:
```typescript
const [allRes, uncategorizedRes, starredRes, todayRes] = await Promise.all([
  supabase.from("notes").select("id", { count: "exact", head: true }),
  // ... 其他查询
]);

setCounts({
  uncategorized: uncategorizedRes.count ?? 0,
  all: allRes.count ?? 0,
  starred: starredRes.count ?? 0,
  today: todayRes.count ?? 0,
});
```

**After**:
```typescript
const [allRes, uncategorizedRes, starredRes, todayRes, untaggedRes] = await Promise.all([
  supabase.from("notes").select("id", { count: "exact", head: true }),
  // ... 其他查询
  supabase.rpc("count_untagged_notes"), // ← 新增
]);

setCounts({
  uncategorized: uncategorizedRes.count ?? 0,
  all: allRes.count ?? 0,
  starred: starredRes.count ?? 0,
  today: todayRes.count ?? 0,
  untagged: untaggedRes.data ?? 0, // ← 新增
});
```

### 4. Note Filtering

#### fetchNotes() 函数 - 标签筛选逻辑

**Before**:
```typescript
if (activePrimary === "tags" && selectedTag) {
  let tagIds = [selectedTag];
  
  if (includeChildTags) {
    const descendantIds = getDescendantTagIds(tagTree, selectedTag);
    tagIds = descendantIds.length > 0 ? descendantIds : [selectedTag];
  }
  
  const { data: tagNoteRows } = await supabase
    .from("note_tags")
    .select("note_id")
    .in("tag_id", tagIds);
  
  const noteIds = tagNoteRows?.map((row) => row.note_id) ?? [];
  if (noteIds.length === 0) {
    setNotes([]);
    setHasMore(false);
    setInitialLoading(false);
    setLoadingMore(false);
    return;
  }
  query = query.in("id", noteIds);
}
```

**After**:
```typescript
if (activePrimary === "tags") {
  if (selectedTag === null) {
    // ← 新增：处理"无标签"筛选
    // Show notes with no tags (untagged notes)
    const { data: taggedNoteRows } = await supabase
      .from("note_tags")
      .select("note_id");
    
    const taggedNoteIds = taggedNoteRows?.map((row) => row.note_id) ?? [];
    if (taggedNoteIds.length > 0) {
      query = query.not("id", "in", `(${taggedNoteIds.join(",")})`);
    }
    // If no tagged notes exist, all notes are untagged, so no filter needed
  } else if (selectedTag) {
    // Show notes with specific tag(s)
    let tagIds = [selectedTag];
    
    if (includeChildTags) {
      const descendantIds = getDescendantTagIds(tagTree, selectedTag);
      tagIds = descendantIds.length > 0 ? descendantIds : [selectedTag];
    }
    
    const { data: tagNoteRows } = await supabase
      .from("note_tags")
      .select("note_id")
      .in("tag_id", tagIds);
    
    const noteIds = tagNoteRows?.map((row) => row.note_id) ?? [];
    if (noteIds.length === 0) {
      setNotes([]);
      setHasMore(false);
      setInitialLoading(false);
      setLoadingMore(false);
      return;
    }
    query = query.in("id", noteIds);
  }
}
```

**设计决策**：
- `selectedTag === null` 表示选中"无标签"
- 查询所有有标签的笔记 ID，然后使用 `NOT IN` 排除
- 如果没有任何有标签的笔记，则不添加筛选条件（所有笔记都是无标签）

### 5. UI Rendering

#### "无标签"按钮

**Before**:
```tsx
<span className="text-xs text-gray-400">0</span>
```

**After**:
```tsx
<span className="text-xs text-gray-400">{counts.untagged}</span>
```

---

## Performance Considerations

### Database Query Performance

#### count_untagged_notes() 函数

**查询计划**：
```
Aggregate  (cost=X..Y rows=1)
  ->  Seq Scan on notes n  (cost=0.00..X rows=Y)
        Filter: ((user_id = auth.uid()) AND (NOT (SubPlan 1)))
        SubPlan 1
          ->  Index Scan using note_tags_note_id_idx on note_tags nt
                Index Cond: (note_id = n.id)
```

**优化策略**：
- 利用 `note_tags(note_id)` 上的索引
- 利用 `notes(user_id)` 上的索引
- `NOT EXISTS` 比 `NOT IN` 更高效
- 标记为 `STABLE` 允许查询计划缓存

**预期性能**：
- 1,000 笔记：< 10ms
- 10,000 笔记：< 50ms
- 100,000 笔记：< 200ms

#### 无标签笔记筛选查询

**查询逻辑**：
1. 查询所有有标签的笔记 ID：`SELECT note_id FROM note_tags`
2. 排除这些 ID：`WHERE id NOT IN (...)`

**性能问题**：
- 对于大数据集，`NOT IN` 可能性能较差
- 需要先查询所有有标签的笔记 ID，然后传递给主查询

**优化方案（未来）**：
```typescript
// Option 1: 使用 RPC 函数在数据库端完成筛选
const { data: untaggedNotes } = await supabase.rpc("get_untagged_notes", {
  limit: PAGE_SIZE,
  offset: pageToLoad * PAGE_SIZE,
});

// Option 2: 使用 LEFT JOIN 和 IS NULL
// 需要 Supabase 支持更复杂的查询构建
```

### Frontend Performance

#### refreshAll() 并发加载

- 使用 `Promise.all()` 并发执行 `fetchNotes()`, `loadMetadata()`, `loadTags()`
- 减少总等待时间
- 避免阻塞 UI 渲染

---

## Error Handling

### Database Errors

#### RPC 函数执行失败

```typescript
const untaggedRes = await supabase.rpc("count_untagged_notes");

if (untaggedRes.error) {
  console.error("Failed to count untagged notes:", untaggedRes.error);
  // Fallback: 设置为 0，不影响其他功能
  setCounts(prev => ({ ...prev, untagged: 0 }));
}
```

### Frontend Errors

#### 无标签笔记查询失败

```typescript
try {
  const { data: taggedNoteRows } = await supabase
    .from("note_tags")
    .select("note_id");
  
  // ... 处理逻辑
} catch (error) {
  console.error("Failed to fetch untagged notes:", error);
  setNotes([]);
  setNotesLoadingError("加载无标签笔记失败");
}
```

---

## Testing Strategy

### Unit Tests

1. **count_untagged_notes() 函数**
   - 测试无笔记时返回 0
   - 测试所有笔记都有标签时返回 0
   - 测试部分笔记有标签时返回正确数量
   - 测试多用户隔离（只统计当前用户的笔记）

2. **fetchNotes() 无标签筛选**
   - 测试 `selectedTag === null` 时的查询逻辑
   - 测试返回的笔记确实没有任何标签
   - 测试分页和排序功能

### Integration Tests

1. **给笔记打标签后刷新**
   - 给笔记添加标签
   - 验证 `refreshAll()` 后标签列表更新
   - 验证标签的笔记数量正确

2. **无标签笔记筛选**
   - 点击"无标签"按钮
   - 验证显示的笔记都没有标签
   - 验证笔记数量与 `counts.untagged` 一致

### Manual Tests

1. 创建多个笔记，部分有标签，部分无标签
2. 点击"无标签"，验证显示正确
3. 给无标签笔记添加标签，验证计数实时更新
4. 移除笔记的所有标签，验证计数实时更新

---

## Migration Strategy

### Database Migration

1. 用户在 Supabase Dashboard SQL Editor 中执行 `007_add_count_untagged_notes_function.sql`
2. 验证函数创建成功：
   ```sql
   SELECT public.count_untagged_notes();
   ```
3. 验证权限正确：
   ```sql
   SELECT has_function_privilege('authenticated', 'public.count_untagged_notes()', 'EXECUTE');
   ```

### Frontend Deployment

1. 部署新版本前端代码
2. 用户刷新页面后自动使用新功能
3. 无需数据迁移或清理

### Rollback Plan

如果出现问题，可以：
1. 回滚前端代码到上一版本
2. 删除 RPC 函数（可选）：
   ```sql
   DROP FUNCTION IF EXISTS public.count_untagged_notes();
   ```

---

## Security Considerations

### RPC Function Security

- 使用 `auth.uid()` 确保只统计当前用户的笔记
- 使用 `SECURITY DEFINER` 确保权限正确
- 只授权 `authenticated` 角色执行

### Data Access

- 所有查询都通过 Supabase RLS 策略保护
- 用户只能访问自己的笔记和标签
- 无标签笔记筛选不会泄露其他用户的数据

---

## Documentation Updates

### supabase/README.md

添加新的迁移文件说明：

```markdown
### 007_add_count_untagged_notes_function.sql ⚠️ **需要立即执行**
添加无标签笔记计数功能：
- 创建 `count_untagged_notes()` RPC 函数
- 用于统计当前用户没有任何标签的笔记数量
- 支持标签页"无标签"筛选功能
```

---

## Future Improvements

1. **性能优化**
   - 为无标签笔记查询创建专用视图或索引
   - 使用物化视图缓存计数结果
   - 监控查询性能，必要时优化

2. **功能增强**
   - 支持批量给无标签笔记添加标签
   - 支持"无标签"状态下的批量操作
   - 添加"无标签"笔记的快捷操作

3. **用户体验**
   - 添加加载状态指示器
   - 添加错误提示和重试机制
   - 优化大数据集下的加载性能

---

## Appendix

### Related Files

- `components/dashboard/dashboard-content.tsx`
- `supabase/migrations/007_add_count_untagged_notes_function.sql`
- `supabase/README.md`

### Related Changes

- `add-tag-management`: 标签管理基础功能
- `enhance-my-collections`: 笔记收藏功能

### References

- Supabase RPC Functions: https://supabase.com/docs/guides/database/functions
- PostgreSQL NOT EXISTS: https://www.postgresql.org/docs/current/functions-subquery.html

