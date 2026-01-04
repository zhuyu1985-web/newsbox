## Context
P0 知识库已提供“全库 RAG 对话 + 引用溯源”，但缺少把内容组织成“专题/脉络”的结构化层。

## Goals / Non-Goals
- Goals:
  - 生成用户专属的专题集合（topics）并持久化
  - 专题详情提供：按时间排序的条目列表、时间线视图、专题报告
  - 支持增量刷新（只处理新增/更新的笔记）
- Non-Goals:
  - 图谱（NER/RE）与素材库抽取
  - 强实时（每次收藏立即聚类）

## Decisions
- **生成策略（P1 v1）**：以“按需生成/刷新”为主，后续可加 nightly job。
  - UI 提供“生成/刷新专题”按钮。
- **Embedding**：对每篇 `notes` 生成向量并缓存，避免重复计算。
  - 输入文本优先级：`title + excerpt + content_text (截断)`
  - 通过环境变量配置 embedding provider/model。
- **Clustering**：在服务端对 embedding 进行聚类，产出 topic 与 membership。
  - P1 v1 先用 K-Means（固定 K 或基于启发式）
  - 后续可迭代为 DBSCAN/层次聚类。
- **专题命名/关键词**：对每个 cluster 选取代表文本（Top-N 标题/片段），用 LLM 生成 topic 标题与关键词。
- **时间线**：P1 v1 以 `published_at`（若为空用 `created_at`）排序展示专题内条目；“大事件”先使用条目标题/摘要作为事件卡，后续再做事件抽取。
- **持久化与可重复生成**：专题生成是可重入的；对同一用户支持覆盖式刷新。

## Data Model (Proposed)
- `knowledge_note_embeddings`
  - `note_id`, `user_id`, `embedding`, `model`, `content_hash`, timestamps
- `knowledge_topics`
  - `id`, `user_id`, `title`, `keywords`, `summary_markdown`, `updated_at`
- `knowledge_topic_members`
  - `topic_id`, `note_id`, `user_id`, `score`, timestamps

## API (Proposed)
- `GET /api/knowledge/topics`：返回专题列表（按最近更新时间）
- `POST /api/knowledge/topics/rebuild`：触发生成/刷新（支持 scope：全量/最近 N 天）
- `GET /api/knowledge/topics/:id`：专题详情（包含条目列表 + 时间线数据 + 报告）

## Privacy
- 所有查询/写入必须以 `auth.uid()` 限制（RLS + 服务端鉴权双保险）。

## Migration Plan
- 增加新 migration：创建上述三张表并启用 RLS。

## Open Questions
- Embedding provider：沿用当前 OpenAI-compatible provider 还是单独配置？
- K 的选择策略：固定 K vs. 动态 K（基于轮廓系数等）。
