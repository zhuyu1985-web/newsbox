## Context
本项目已在 P1 落地 Smart Topics 基础链路（embedding → clustering → topic/members → 列表/详情/报告），对应迁移为 `014_add_knowledge_smart_topics.sql`：
- `knowledge_note_embeddings`（embedding JSONB + content_hash）
- `knowledge_topics`（title/keywords/summary_markdown/member_count/config）
- `knowledge_topic_members`（topic_id/note_id/score）

P2/P3 需要从“聚类结果展示”走向“叙事重构工作台”：
- 时间轴按 **事件发生时间**（event time）组织
- 同一事件多篇报道 **去重合并为节点**
- 人工可控：合并/移入/移出/确认归类
- 生命周期：自动归档 + 置顶
- 跨专题线索：实体抽取与关联提示

## Goals / Non-Goals
- Goals
  - 提供可复用的数据结构支撑“专题 → 事件节点 → 证据条目（notes）”的叙事层
  - 支持 DBSCAN/HDBSCAN 聚类、噪声识别、增量更新
  - 支持人机协作：用户修改应能覆盖 AI 结果且可追踪
  - UI 交互升级后仍保持低延迟（切换无需刷新、加载无跳动）
- Non-Goals
  - 不做跨用户公共专题/协作
  - 不做复杂图谱编辑

## Architecture Overview
### Pipeline
1. **Daily ingest**：用户收藏内容进入 `notes`
2. **Cleaning**：抽取可用于语义表示的文本（title + excerpt + content_text 截断）
3. **Embedding**：生成 embedding，写入 `knowledge_note_embeddings`
4. **Clustering**：对候选 notes 运行 DBSCAN/HDBSCAN → cluster
5. **Topic update**：cluster 与已有 topic 做匹配（topic centroid/代表条目），决定新建/增量加入
6. **Naming + Keywords**：对每个 topic 取代表条目（3-5）给 LLM 生成标题/关键词
7. **Timeline Engine**：对 topic 内条目提取事件发生时间/事件指纹 → 聚合成 timeline nodes
8. **Report**：LLM 生成综述报告（可重写）

### Triggering
- 定时触发：每日 2:00（Supabase Scheduled Edge Functions；若需要 pg_cron，可作为自建扩展备选）
- 手动触发：前端按钮触发 `POST /api/knowledge/topics/rebuild` 或新增 `POST /api/knowledge/topics/recluster`

## Data Model (Proposed)
> 原则：尽量在现有三表基础上“增量扩展”，并把人工干预记录为显式字段/表，以便覆盖 AI 结果。

### 1) `knowledge_topics` 扩展字段
- `pinned boolean default false`
- `pinned_at timestamptz`
- `archived boolean default false`
- `archived_at timestamptz`
- `cover_image_url text null`
- `last_ingested_at timestamptz`（最近一次新增成员时间，用于 New 红点/生命周期）
- `stats jsonb`（跨度、实体数量、节点数等派生统计）

### 2) `knowledge_topic_members` 扩展字段
- `source text not null default 'auto'`（auto/manual）
- `manual_state text null`（pinned/excluded/…，或用 bool 字段组合）
- `event_time timestamptz null`（事件发生时间，P2 可直接落在 member 级别）
- `event_fingerprint text null`（用于事件去重聚合）
- `evidence_rank real`（事件节点内证据排序）

### 3) 事件节点（P2）：新增 `knowledge_topic_events`
- `id uuid pk`
- `user_id uuid`
- `topic_id uuid`
- `event_time timestamptz`
- `title text`（事件卡标题）
- `summary text`（事件节点摘要，可选）
- `fingerprint text`（唯一键：topic_id + fingerprint）
- `importance real`（大/小节点）
- `source jsonb`（由哪些 notes 聚合）

### 4) 实体与关联（P3）：新增 `knowledge_entities` / `knowledge_topic_entities`
- `knowledge_entities`：`id/user_id/name/type/aliases/json`
- `knowledge_topic_entities`：`topic_id/entity_id/weight`
- `knowledge_note_entities`：`note_id/entity_id/mentions`

## Clustering Strategy
### Candidate selection
- 仅处理满足以下条件的 notes：
  - 有可用正文/摘要（否则降级为 title-only embedding）
  - `knowledge_note_embeddings` 不存在或 `content_hash` 变化

### Algorithm
- P2 推荐：DBSCAN（或 HDBSCAN）
  - 距离：cosine distance（embedding 归一化后 1 - cosine）
  - 参数：
    - `min_samples = 3`（避免微型专题泛滥）
    - `eps` 自适应：按用户库分位数估计（例如 0.25 分位的近邻距离）
- Topic matching：
  - cluster centroid 与 topic centroid（或代表条目向量）相似度 > 0.85 → 归入旧 topic
  - 否则创建新 topic

### Incremental update
- 对新增/变更 notes 先做“最近 topic centroid top-k”相似度匹配（快速路径）
- 匹配失败再进入 DBSCAN（慢路径）

## Timeline Engine
### Event time extraction (P2)
- 入库分析阶段：对每条 note 提取“事件发生时间”
  - 规则优先：`published_at`（若 note 的来源提供）
  - LLM 补充：从正文中抽取事件时间（支持相对时间、日期范围）；输出 ISO 日期或 null
- 存储：写入 `knowledge_topic_members.event_time` 或独立表

### Dedup & node building
- 生成 `event_fingerprint`：
  - `normalize(date)` + `key entities` + `top keywords`（可 hash）
- 同 fingerprint 的多条报道聚合为一个 `knowledge_topic_events` 节点

## LLM Prompts (Key)
- Naming Prompt：
  - 输入：3-5 篇代表条目的 title + 1 行摘要
  - 输出：≤10 字中文标题 + 3-8 个关键词
- Report Prompt：
  - 输出结构：背景/起因、核心冲突与立场、关键进展、未决问题、可能走向
  - 需带引用（note ids）

## APIs (Proposed)
- `POST /api/knowledge/topics/recluster`：触发增量聚类（支持 scope：最近 N 天/指定 folder/tag）
- `POST /api/knowledge/topics/:id/merge`：合并两个 topic（重算 members/events/report）
- `POST /api/knowledge/topics/:id/members`：手动加入/移出/确认归类
- `POST /api/knowledge/topics/:id/report`：生成/重写报告
- `POST /api/knowledge/topics/:id/pin` / `POST /api/knowledge/topics/:id/archive`

## RLS / Security
- 所有表必须启用 RLS 并基于 `auth.uid() = user_id`
- 服务器端 API 再做一次 `supabase.auth.getUser()` 鉴权与 user_id 校验

## Migration Plan
- 新增 migration：为 `knowledge_topics`/`knowledge_topic_members` 增加字段；创建 `knowledge_topic_events`；（P3）创建实体表。

## Rollout Plan
- 先灰度 P2：仅开启“事件时间轴 + 去重节点 + 手动移入/移出/合并”
- 验证质量与性能后，再开启定时任务与 P3 图谱联动

## Open Questions
- Deno Edge Functions 的聚类库选型：是否引入专用 worker（Node/Python）？
- event time 的准确性评估：是否需要人工校正入口与审计日志？
- topic centroid 的存储：继续 JSONB 还是引入 pgvector（需要扩展与索引策略）
