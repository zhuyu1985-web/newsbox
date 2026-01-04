## Context
NewsBox 已有单篇笔记的 AI 解读与追问（`/api/ai/analyze`, `/api/ai/chat`），但缺少跨笔记的“知识库问答”。本变更优先交付可用的 P0：全库问答 + 引用溯源。

## Goals / Non-Goals
- Goals:
  - Provide a Knowledge Base Q&A entry point in Dashboard
  - Answer questions by retrieving relevant saved content and generating a synthesized response
  - Show citations linking back to original notes
- Non-Goals:
  - Embeddings/pgvector and semantic search
  - Topic clustering, knowledge graph, asset extraction

## Decisions
- **Retrieval strategy (P0)**: include the following user-owned corpus in keyword/full-text search, returning a ranked Top-K evidence list:
  - `notes`: `title`, `excerpt`, `content_text`, `site_name`, `source_url`
  - `highlights`: `quote`（可选：`timecode`）
  - `annotations`: `content`（可选：关联的 `highlights.quote`）
  - `transcripts`: `full_text`（可选：基于 `segments[].text` 生成更短 snippet）
  - `ai_outputs`: `summary`（可选：`transcript`）
  - Implementation detail: run per-table user-scoped queries in parallel (use FTS where available, otherwise `ilike`), then merge+score in app code.
- **Chat generation**: reuse existing OpenAI chat streaming approach; prompt includes:
  - user question
  - retrieved contexts (truncated)
  - strict instruction to include citations as `[note:<id>]` (MVP keeps citations at note-level)
- **Citations format**: API returns `citations: [{ noteId, title, sourceUrl, excerpt, evidence?: { kind, sourceId } }]` and answer text references them.

## Risks / Trade-offs
- Keyword search may miss semantically relevant items. Mitigate by query expansion and later adding embeddings.
- Token budget: cap K and per-item snippet length, prioritize user-generated content (annotations/highlights) when relevant.

## Migration Plan
No database schema changes in MVP.

## Open Questions
- Do we store chat history server-side (new table) or keep it client-only for MVP?
