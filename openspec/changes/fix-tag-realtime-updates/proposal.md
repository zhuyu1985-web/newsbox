# Proposal: Fix Tag Realtime Updates

**Change ID**: `fix-tag-realtime-updates`  
**Status**: Draft  
**Created**: 2025-12-25  
**Author**: AI Assistant

---

## Why

当前标签页存在两个关键问题：

1. **标签列表不实时更新**：当用户在标签页选中笔记并给笔记打上标签后，标签列表的笔记数量不会实时更新，需要手动刷新页面才能看到最新数据。
2. **"无标签"计数不正确**："无标签"状态下显示的笔记数量始终为 0，没有正确统计没有任何标签的笔记数量。

这两个问题严重影响用户体验，导致用户对系统状态产生困惑，无法及时看到操作结果。

---

## What

修复标签管理功能的实时更新问题：

### 1. 标签列表实时更新
- 在 `refreshAll()` 函数中添加 `loadTags()` 调用
- 确保给笔记打标签后，标签列表的笔记数量立即更新

### 2. "无标签"笔记计数
- 创建数据库 RPC 函数 `count_untagged_notes()` 来统计没有任何标签的笔记
- 在 `Counts` 接口中添加 `untagged` 字段
- 在 `loadMetadata()` 中查询并更新无标签笔记计数
- 在 UI 中显示正确的无标签笔记数量

### 3. "无标签"筛选功能
- 修改 `fetchNotes()` 函数，支持 `selectedTag === null` 的情况
- 当选中"无标签"时，查询所有没有关联任何标签的笔记
- 使用 `NOT IN` 查询排除所有有标签的笔记

---

## Scope

### In Scope
- 修复 `refreshAll()` 函数，添加标签加载逻辑
- 创建数据库迁移 `007_add_count_untagged_notes_function.sql`
- 实现无标签笔记计数和筛选功能
- 更新 UI 显示正确的无标签笔记数量

### Out of Scope
- 标签拖拽排序功能（已在 `add-tag-management` 中规划）
- 标签批量操作功能
- 标签搜索功能优化
- 标签颜色和图标的高级自定义

---

## User Impact

### Before
- 给笔记打标签后，标签列表不更新，用户需要手动刷新页面
- "无标签"显示数量始终为 0，无法正确反映实际情况
- 点击"无标签"无法正确筛选出没有标签的笔记

### After
- 给笔记打标签后，标签列表立即更新，显示最新的笔记数量
- "无标签"显示正确的笔记数量
- 点击"无标签"可以正确筛选出所有没有任何标签的笔记
- 用户体验流畅，操作反馈及时

---

## Technical Considerations

### Database
- 新增 RPC 函数 `count_untagged_notes()`
- 使用 `NOT EXISTS` 子查询优化无标签笔记查询性能
- 函数使用 `SECURITY DEFINER` 确保权限正确
- 函数标记为 `STABLE` 优化查询计划

### Frontend
- 修改 `Counts` 接口，添加 `untagged` 字段
- 修改 `refreshAll()` 函数，添加 `loadTags()` 调用
- 修改 `loadMetadata()` 函数，添加无标签计数查询
- 修改 `fetchNotes()` 函数，支持无标签筛选逻辑

### Performance
- `count_untagged_notes()` 使用索引优化的 `NOT EXISTS` 查询
- 无标签笔记筛选使用 `NOT IN` 查询，对于大数据集可能需要优化
- 考虑后续使用物化视图或缓存来优化性能

---

## Alternatives Considered

### Alternative 1: 客户端计算无标签笔记数量
**Rejected**: 需要加载所有笔记和标签关联数据，性能差且不准确。

### Alternative 2: 使用物化视图存储无标签计数
**Deferred**: 当前数据量不大，RPC 函数足够高效。未来数据量增长后可以考虑。

### Alternative 3: 使用 WebSocket 实时推送更新
**Deferred**: 过度设计，当前场景下用户主动操作后刷新即可满足需求。

---

## Success Criteria

1. ✅ 给笔记打标签后，标签列表立即更新
2. ✅ "无标签"显示正确的笔记数量（非 0）
3. ✅ 点击"无标签"可以筛选出所有没有标签的笔记
4. ✅ 数据库迁移脚本执行成功，RPC 函数创建成功
5. ✅ 无 linter 错误
6. ✅ 所有现有功能正常工作，无回归问题

---

## Dependencies

- 依赖 `add-tag-management` 变更（标签管理基础功能）
- 需要执行数据库迁移 `007_add_count_untagged_notes_function.sql`

---

## Risks

### Risk 1: 无标签笔记查询性能
**Mitigation**: 使用 `NOT EXISTS` 子查询，利用索引优化。监控查询性能，必要时添加专用索引。

### Risk 2: 并发更新导致计数不一致
**Mitigation**: 使用数据库事务和 RPC 函数确保数据一致性。

---

## Open Questions

1. ~~是否需要为无标签笔记查询添加专用索引？~~  
   **Answer**: 当前使用现有索引即可，后续根据性能监控决定。

2. ~~是否需要支持"包含子标签"选项对无标签筛选的影响？~~  
   **Answer**: 无标签筛选不受"包含子标签"选项影响，因为没有标签层级关系。

---

## Next Steps

1. ✅ 创建数据库迁移脚本 `007_add_count_untagged_notes_function.sql`
2. ✅ 修改前端代码实现实时更新和无标签计数
3. ✅ 更新 `supabase/README.md` 文档
4. 🔄 用户执行数据库迁移
5. 🔄 测试所有功能，确保无回归问题
6. 🔄 更新 `tasks.md` 标记完成状态

