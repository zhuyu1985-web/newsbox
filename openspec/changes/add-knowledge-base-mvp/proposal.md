# Change: Add Knowledge Base MVP (全库问答)

## Why
NewsBox 当前“我的收藏”更像仓库：把信息存下来，但缺少把碎片内容结构化、可复用的“加工”层。目标用户（新闻记者/深度阅读者）需要在大量收藏中快速形成观点、找证据、回溯出处。

## What Changes
- Add a new **Knowledge Base** primary navigation view (Dashboard `knowledge` tab) focused on **全库问答**。
- Provide a Knowledge chat experience that:
  - retrieves relevant notes (and optionally annotations/highlights/transcripts later)
  - generates an answer with **citations** pointing back to original notes
  - supports follow-up questions in the same thread
- Add backend API endpoints for Knowledge chat/search.

## Scope (MVP)
- **P0**: 全库 RAG 问答（基于现有内容字段的检索 + LLM 总结 + 引用溯源）。

## Out of Scope (for this change)
- Vector embeddings / pgvector schema / similarity search
- Auto-topic clustering (Smart Topics)
- Entity knowledge graph visualization
- Asset bank extraction pipelines

## Impact
- Affected specs:
  - `dashboard` (navigation and entry point)
  - **NEW** `knowledge-base` capability
- Affected code:
  - Dashboard UI (`components/dashboard/dashboard-content.tsx`)
  - New API routes under `app/api/knowledge/*`
  - Reuse existing OpenAI service (`lib/services/openai.ts`) where possible

## Risks
- Retrieval quality depends on current text fields; without embeddings, semantic recall is limited.
- Token/cost control: must truncate contexts and cap retrieved items.
- Privacy: all retrieval MUST be scoped to the authenticated user.
