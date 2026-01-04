## 1. Implementation
- [ ] 1.1 新增数据库表 `ai_snapshots` 与 `ai_snapshot_renders`（含索引与RLS）
- [ ] 1.2 新增 Storage bucket `ai-snapshots` 与对应 objects policies
- [ ] 1.3 实现快照查询接口（`GET /api/ai/snapshot`）
- [ ] 1.4 实现快照首生成/渲染复用接口（`POST /api/ai/snapshot/ensure`）
- [ ] 1.5 复用/重构渲染组件，确保渲染输入来自 DB 的 `card_data`
- [ ] 1.6 改造前端 `AISnapshotView`：进入先查库、切换风格只取已渲染结果
- [ ] 1.7 增加并发去重与缓存（服务端 + 前端 in-flight）

## 2. Validation
- [ ] 2.1 首次生成同一 note 只调用一次 AI（并发点击/刷新也只结算一次）
- [ ] 2.2 切换风格不调用 AI，仅渲染/取图
- [ ] 2.3 刷新/再次进入可直接命中 DB + Storage
