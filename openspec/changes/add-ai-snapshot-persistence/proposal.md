# Change: Add AI snapshot persistence and deduplication

## Why
当前 `AI 快照` 的 `/api/snapshot` 每次请求都会调用 `generateSnapshotData()`（OpenAI）并即时渲染图片，缺少数据库/对象存储层的持久化与去重，导致用户重复进入、刷新、切换风格时反复消耗模型与渲染资源。

## What Changes
- 新增 **AI 快照持久化机制**：将快照的结构化内容（卡片数据）落库，将渲染后的图片文件保存到 Supabase Storage，数据库只保存对象路径并在接口层生成可访问链接。
- 新增 **进入界面先查库** 的校验逻辑：优先返回已存在的快照与已渲染风格。
- 调整 **风格切换**：基于已存储的结构化快照数据渲染/变换，不再触发 AI 模型调用。
- 增加 **并发去重**：同一条新闻/同一版本（基于内容指纹）只允许一次“首生成（AI）”结算。
- **接口优化**：将“查询/首生成/渲染/取链接”拆分为更清晰的 API 契约，避免前端拿 blob 再转 objectURL 的临时方案。

## Impact
- **Affected specs**: `ai-snapshots` (new)
- **Affected code**:
  - `app/api/snapshot/*`（拆分为 query + render + ensure）
  - `components/reader/ContentStage/AISnapshotView.tsx`（进入先查，切换风格改为取已有 render）
  - `lib/services/snapshot.ts`（AI 仅用于生成结构化卡片数据；渲染与存储复用）
  - `supabase/migrations/*`（新增快照表、render 表、bucket 与 RLS policies）

## Non-Goals
- 不做跨用户的“全局新闻去重共享”（只保证同一用户/同一 note 的去重）。
- 不引入异步队列/后台任务系统（本变更以同步接口 + 缓存为主）。
