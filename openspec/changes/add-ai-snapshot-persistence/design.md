## Context
当前实现：`/api/snapshot` 直接调用 OpenAI 输出卡片数据并用 `@vercel/og` 渲染图片返回。没有任何持久化、版本控制与存储复用。

数据库现状：
- `public.notes` 存内容（`content_text`/`content_html`）、标题、来源等
- `public.ai_outputs` 用于 AI 解读（summary/key_questions/…），但 `summary` 为 NOT NULL，且表是 `note_id` 唯一，结构不适合仅存快照
- Storage bucket 目前仅见 `zhuyu`（public=true），且 objects policy 以“按用户目录”控制为主

## Goals / Non-Goals
- **Goals**
  - 首次生成新闻快照时才调用 AI；之后所有访问与风格切换不再调用 AI。
  - 快照图片落 Supabase Storage；数据库保存 bucket/path 与元数据；访问链接通过接口生成（签名 URL）。
  - 进入 `AI 快照` 界面优先查库：命中则秒开，不触发生成。
  - 并发安全：同一 `note_id` + `content_hash` 的首生成只能成功一次。

- **Non-Goals**
  - 跨用户共享去重（RLS 复杂度高，先不做）。
  - 引入队列/worker（后续可演进）。

## Data Model
### 1) `ai_snapshots`
用于保存“AI 只生成一次”的结构化快照内容。

- `id` UUID PK
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `note_id` UUID NOT NULL REFERENCES `notes(id)`
- `content_hash` TEXT NOT NULL  
  - 用 `notes.title + content_text/content_html` 计算稳定 hash（例如 SHA-256）
- `card_data` JSONB NOT NULL
  - `{ one_liner, bullet_points, sentiment, key_stat, source_name, publish_time, ... }`
- `model_provider`/`model_name`/`model_version` TEXT
- `status` TEXT NOT NULL DEFAULT 'ready'  (ready|failed)
- `error_message` TEXT
- `created_at`/`updated_at` TIMESTAMPTZ

Indexes / Constraints:
- UNIQUE (`note_id`, `content_hash`)：同一版本只会有一条快照（去重关键）
- INDEX (`user_id`, `note_id`, `updated_at` DESC)

### 2) `ai_snapshot_renders`
保存每个快照版本在不同 `template` 下渲染出的图片对象。

- `id` UUID PK
- `snapshot_id` UUID NOT NULL REFERENCES `ai_snapshots(id)` ON DELETE CASCADE
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `note_id` UUID NOT NULL REFERENCES `notes(id)`
- `template` TEXT NOT NULL  (business|deep|social)
- `bucket` TEXT NOT NULL
- `object_path` TEXT NOT NULL
- `width` INT NOT NULL DEFAULT 1200
- `height` INT NOT NULL DEFAULT 1600
- `content_type` TEXT NOT NULL DEFAULT 'image/png'
- `created_at` TIMESTAMPTZ

Indexes / Constraints:
- UNIQUE (`snapshot_id`, `template`)：每个快照版本每种风格最多一张
- INDEX (`user_id`, `note_id`)

## Storage
- 新建 bucket：`ai-snapshots`（`public=false`）
- 对象路径：`{user_id}/notes/{note_id}/{content_hash}/{template}.png`
- 访问：通过 API 返回 signed URL（可配置 5-15 分钟过期）

## API Design
以 JSON 为主，避免前端拿 blob 再转 objectURL。

### 1) `GET /api/ai/snapshot?noteId=...`
- 认证：必须登录
- 行为：
  - 读取 note 内容，计算 `content_hash`
  - 查 `ai_snapshots` 是否存在 (`note_id`, `content_hash`, `user_id`)
  - 若存在：返回 `snapshot_id`、`card_data`（可选）与已存在的 render 列表（每个附带 signed URL）
  - 若不存在：返回 `exists=false`，不触发生成

### 2) `POST /api/ai/snapshot/ensure`
- Body：`{ noteId, template?, force? }`
- 行为：
  - 计算 `content_hash`
  - **并发去重**：先尝试插入 `ai_snapshots`（on conflict do nothing）
  - 若插入成功：调用 AI 生成 `card_data` 并更新该行
  - 若已存在：跳过 AI，直接复用 `card_data`
  - 若 template 指定：确保 `ai_snapshot_renders` 存在；不存在则渲染并上传
  - 返回：render 的 signed URL + 元信息

### 3) `POST /api/ai/snapshot/render`
（可选拆分：如果 `ensure` 覆盖渲染，该接口可作为内部复用）

## Rendering Strategy (No AI)
- 渲染依旧使用 `@vercel/og` 的 `BusinessCard/DeepCard/SocialCard`
- 渲染输入改为 `card_data`（来自 DB），而不是每次都重新调用 AI
- 新增 `renderSnapshotPng(cardData, template) -> Uint8Array/ArrayBuffer`

## Frontend Changes
- `AISnapshotView` 挂载时：先调用 `GET /api/ai/snapshot`；如果命中则直接展示 signed URL
- 未命中：调用 `POST /api/ai/snapshot/ensure`（只会触发一次 AI）
- 风格切换：只调用 `ensure` 的渲染分支（不会触发 AI），或直接从 `GET` 返回的 renders 中取

## Security / RLS
- `ai_snapshots` / `ai_snapshot_renders` 开启 RLS：
  - SELECT/INSERT/UPDATE/DELETE 限制为 `user_id = auth.uid()`
- Storage bucket `ai-snapshots`：
  - 允许 authenticated 在自己前缀 `{auth.uid()}/...` 下读写

## Migration Notes
- 新增两张表 + 索引 + RLS policy
- 新增 bucket + objects policy
- 不修改现有 `ai_outputs`（避免与既有功能耦合/破坏 `summary NOT NULL` 约束）
