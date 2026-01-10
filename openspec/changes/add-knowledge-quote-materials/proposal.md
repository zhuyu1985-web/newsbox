# Change: Add Knowledge Base Quote Materials (金句素材)

## Why
用户在阅读、批注、写稿时需要把“关键表达/金句”快速沉淀为可复用素材。目前系统只有高亮/批注与知识库（对话/专题/图谱），缺少一个将金句系统化管理与可回溯引用的“素材层”。

## What Changes
- 在「知识库」中完善“金句素材”子视图：展示、检索、复制、跳转到来源笔记。
- **来源 1（手动入库）**：在批注列表与阅读页批注卡片中提供“设为金句素材/取消”操作，将该批注对应的表达入库为金句素材。
- **来源 2（自动入库）**：支持对单篇稿件/笔记触发大模型“自动识别金句”，将结果写入金句素材（带来源与生成元数据）。

## Non-Goals (This Change)
- 复杂编排（多层文件夹/项目/稿件分组）与协作分享流程。
- 自动后台批量跑全库（先做按需触发，避免成本与体验风险）。
- 高级“改写/风格化/标题生成”等二次创作能力（后续迭代）。

## Impact
- Affected specs:
  - `annotations`（新增“设为金句素材”入口与状态反馈）
  - **NEW** `quote-materials`（素材的数据模型、列表与自动提取流程）
- Affected code (expected):
  - 批注列表与阅读页批注卡片组件（例如 `components/reader/RightSidebar/AnnotationList.tsx`，以及 dashboard 批注视图相关组件）
  - 知识库金句子视图（`components/dashboard/knowledge-view.tsx`）
  - 新增 API 路由（`app/api/quote-materials/*`）
  - Supabase schema/migrations（新增 `quote_materials` 表及 RLS）

## Risks / Open Questions
- “金句素材”的最小可用展示形态：仅列表/复制/回溯是否足够？是否需要标签/搜索/筛选优先？
- 自动提取是“直接入库”还是“先给候选、用户确认后入库”？（本提案按“触发即入库 + 可删除”设计，便于先落地）
- 自动提取的来源范围：仅 `notes.content_text`，还是也包含 `highlights/annotations/transcripts`？（本提案 P0 仅稿件正文，后续扩展）

