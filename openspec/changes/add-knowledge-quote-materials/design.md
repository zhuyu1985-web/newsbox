# Design: Quote Materials (金句素材)

## Overview
“金句素材”是一个可回溯到来源笔记的短文本素材集合，支持两类入库方式：
1) **手动入库**：从批注（以及其关联的高亮引用）一键入库。
2) **自动入库**：对单篇笔记触发 LLM 抽取，将候选金句入库并标记来源为 `llm`。

此能力在 UI 上以「知识库 → 金句素材」子视图承载，强调“随时查阅/复制/回溯出处”。

## Data Model (Proposed)
新增表：`public.quote_materials`
- `id` UUID PK
- `user_id` UUID FK → `auth.users(id)`（RLS 按用户隔离）
- `note_id` UUID FK → `public.notes(id)`（溯源与跳转）
- `highlight_id` UUID NULL FK → `public.highlights(id)`（可选，若素材来自高亮引用）
- `annotation_id` UUID NULL FK → `public.annotations(id)`（可选，若素材来自批注记录）
- `content` TEXT NOT NULL（素材正文）
- `source_type` TEXT NOT NULL（建议枚举：`manual` | `llm`）
- `source_meta` JSONB NULL（模型名、提示词版本、置信度、抽取位置等审计信息）
- `created_at` / `updated_at`

建议约束：
- 去重：同一用户同一笔记下 `content` 去重（可用 `UNIQUE (user_id, note_id, md5(content))` 或 `content_hash` 字段）。
- 来源一致性：`annotation_id` 与 `highlight_id` 至少一个为 NULL（允许同时存在，但需明确优先级与显示规则）。

## API Surface (Proposed)
以 Next.js Route Handlers 提供最小能力：
- `GET /api/quote-materials`：分页列出当前用户素材（可选参数：`note_id`、`q` 搜索）。
- `POST /api/quote-materials`：创建素材（手动入库：由 `annotation_id` 或 `highlight_id` 推导 `content` 与 `note_id`）。
- `DELETE /api/quote-materials?id=...`：删除素材。
- `POST /api/quote-materials/extract`：对 `note_id` 执行 LLM 抽取并批量入库，返回新增条目与去重统计。

## LLM Extraction (P0)
目标：从稿件正文中抽取 3–10 条“可引用的金句/关键表达”，必须**原文可验证**。

建议策略：
- 输入：`notes.title` + `notes.content_text`（截断至合理长度，避免 token 爆炸）。
- 输出：JSON 数组，每条包含 `content`（金句文本）与可选 `reason`/`category`。
- 服务端校验：仅入库那些在 `content_text` 中能找到的子串（或经过标准化后的近似匹配）；其余丢弃并记录统计，避免幻觉入库。
- 成本/速率：按需触发；对同一 `note_id` 提供冷却/幂等（比如仅补充新增、或要求用户显式“重新提取”）。

## UI Integration (P0)
- **阅读页批注卡片（右侧批注列表）**：在 “更多” 菜单中加入“设为金句素材/取消”，并显示状态（例如“已入库”）。
- **批注列表视图**：同样提供入口，保证来源 1 覆盖“批注列表”和“阅读批注”两处。
- **知识库 → 金句素材**：展示素材卡片（内容、来源笔记标题/站点、创建时间、来源类型），支持复制与跳转到来源笔记。

## Security / Privacy
- 所有读写都必须 `user_id` 作用域隔离（RLS + 服务器端二次校验）。
- 自动抽取仅对当前用户可访问的 `note_id` 执行。
- `source_meta` 仅用于审计与调试，不存储敏感密钥。

## Future Extensions (Not in P0)
- 候选审核流（suggested → approved）。
- 引用片段位置（offset）与上下文窗口。
- 从 `highlights/annotations/transcripts` 扩展抽取源。
- 素材标签、分组、导出模板、分享卡片生成等。

