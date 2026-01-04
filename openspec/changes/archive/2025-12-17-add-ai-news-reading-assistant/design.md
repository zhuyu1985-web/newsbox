## Context
本变更定义一个 AI 新闻/内容稍后阅读助手的 MVP 能力集合：用户将“在互联网上看过的内容”采集到笔记库/收藏夹中；系统进行内容解析与归档；AI 生成摘要与关键问题；用户可对正文高亮批注、打标签分类，并将内容分享至外部。

参考产品方向：Cubox 的“稍后阅读 + AI 摘要/关键问题/全库问答”理念（见 `https://cubox.pro`）。本设计文件强调可落地、可扩展、可合规的最小架构。

## Goals / Non-Goals
### Goals
- 明确 MVP 的数据对象、核心流程与扩展点
- 保证采集与阅读体验在“解析失败/AI 失败”等降级情况下仍可用
- 预留未来能力：浏览器扩展、全库问答、批量清理、个性化报告等

### Non-Goals
- 不在本次 design 中定义商业级反爬与大规模采集基础设施

## Tech Stack
- **前端**：Next.js + shadcn/ui
  - 动画库：Framer Motion（推荐）或 CSS animations/transitions
  - 视觉效果：CSS 渐变、粒子效果、滚动动画等
- **后端**：Supabase（PostgreSQL 数据库、认证、存储、实时订阅）

## Database Schema（Supabase PostgreSQL 表结构）

### 表结构设计

#### 1. `users` 表
> 注意：Supabase Auth 已提供 `auth.users` 表，此处仅列出应用层需要的扩展字段（如需要可创建 `public.profiles` 表）

如果需要在应用层扩展用户信息，可创建 `public.profiles` 表：
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `folders` 表（收藏夹/分组）
```sql
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- 可选：分组颜色标识
  position INTEGER DEFAULT 0, -- 排序位置
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT folders_user_id_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_folders_user_id_position ON public.folders(user_id, position);
```

#### 3. `notes` 表（笔记/收藏条目）
```sql
CREATE TYPE content_type AS ENUM ('article', 'video', 'audio');
CREATE TYPE note_status AS ENUM ('unread', 'reading', 'archived');

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  
  -- 核心字段
  source_url TEXT NOT NULL,
  content_type content_type NOT NULL DEFAULT 'article',
  
  -- 元数据
  title TEXT,
  author TEXT,
  site_name TEXT,
  published_at TIMESTAMPTZ,
  
  -- 内容
  content_html TEXT, -- 解析后的 HTML 正文
  content_text TEXT, -- 纯文本，用于全文检索和 AI
  excerpt TEXT, -- 摘要/简介
  
  -- 媒体相关（视频/音频）
  cover_image_url TEXT,
  media_url TEXT, -- 视频/音频的直接媒体 URL
  media_duration INTEGER, -- 时长（秒）
  
  -- 状态
  status note_status DEFAULT 'unread',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束
  CONSTRAINT notes_user_id_source_url_unique UNIQUE (user_id, source_url)
);

CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_folder_id ON public.notes(folder_id);
CREATE INDEX idx_notes_user_id_status ON public.notes(user_id, status);
CREATE INDEX idx_notes_user_id_created_at ON public.notes(user_id, created_at DESC);
CREATE INDEX idx_notes_content_type ON public.notes(content_type);

-- 全文检索索引（PostgreSQL）
CREATE INDEX idx_notes_content_text_fts ON public.notes USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_text, '')));
```

#### 4. `tags` 表（标签）
```sql
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT, -- 可选：标签颜色
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT tags_user_id_name_unique UNIQUE (user_id, name)
);

CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_tags_user_id_name ON public.tags(user_id, name);
```

#### 5. `note_tags` 表（笔记-标签多对多关系）
```sql
CREATE TABLE public.note_tags (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_note_id ON public.note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON public.note_tags(tag_id);
```

#### 6. `highlights` 表（高亮）
```sql
CREATE TABLE public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  
  quote TEXT NOT NULL, -- 高亮的文本内容
  range_start INTEGER, -- 选区起始位置（字符偏移）
  range_end INTEGER, -- 选区结束位置（字符偏移）
  range_data JSONB, -- 详细的选区定位信息（DOM path、offsets 等）
  color TEXT DEFAULT '#FFEB3B', -- 高亮颜色
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_highlights_user_id ON public.highlights(user_id);
CREATE INDEX idx_highlights_note_id ON public.highlights(note_id);
CREATE INDEX idx_highlights_user_id_note_id ON public.highlights(user_id, note_id);
```

#### 7. `annotations` 表（批注）
```sql
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES public.highlights(id) ON DELETE CASCADE, -- 可选：关联到高亮
  
  content TEXT NOT NULL, -- 批注内容
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX idx_annotations_note_id ON public.annotations(note_id);
CREATE INDEX idx_annotations_highlight_id ON public.annotations(highlight_id);
```

#### 8. `ai_outputs` 表（AI 输出）
```sql
CREATE TABLE public.ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  
  summary TEXT NOT NULL, -- AI 生成的摘要
  key_questions JSONB NOT NULL DEFAULT '[]'::jsonb, -- 关键问题列表（数组）
  transcript TEXT, -- 视频/音频的转录文本
  
  -- AI 模型信息（审计）
  model_name TEXT, -- 使用的模型名称
  provider TEXT, -- 提供商（如 'openai', 'anthropic'）
  model_version TEXT, -- 模型版本
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT ai_outputs_note_id_unique UNIQUE (note_id) -- 每个笔记只有一个 AI 输出
);

CREATE INDEX idx_ai_outputs_user_id ON public.ai_outputs(user_id);
CREATE INDEX idx_ai_outputs_note_id ON public.ai_outputs(note_id);
CREATE INDEX idx_ai_outputs_provider ON public.ai_outputs(provider);
```

### Row Level Security (RLS) 策略

所有表都需要启用 RLS，确保用户只能访问自己的数据：

```sql
-- 启用 RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;

-- folders 表策略
CREATE POLICY "Users can view their own folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- notes 表策略
CREATE POLICY "Users can view their own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- tags 表策略
CREATE POLICY "Users can view their own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- note_tags 表策略（通过 note_id 或 tag_id 关联的用户）
CREATE POLICY "Users can view note_tags for their notes"
  ON public.note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert note_tags for their notes"
  ON public.note_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.tags
      WHERE tags.id = note_tags.tag_id AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete note_tags for their notes"
  ON public.note_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()
    )
  );

-- highlights 表策略
CREATE POLICY "Users can view their own highlights"
  ON public.highlights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights"
  ON public.highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights"
  ON public.highlights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
  ON public.highlights FOR DELETE
  USING (auth.uid() = user_id);

-- annotations 表策略
CREATE POLICY "Users can view their own annotations"
  ON public.annotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own annotations"
  ON public.annotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations"
  ON public.annotations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations"
  ON public.annotations FOR DELETE
  USING (auth.uid() = user_id);

-- ai_outputs 表策略
CREATE POLICY "Users can view their own ai_outputs"
  ON public.ai_outputs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai_outputs"
  ON public.ai_outputs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai_outputs"
  ON public.ai_outputs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai_outputs"
  ON public.ai_outputs FOR DELETE
  USING (auth.uid() = user_id);
```

### 触发器（自动更新时间戳）

```sql
-- 创建更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加触发器
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_highlights_updated_at BEFORE UPDATE ON public.highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_outputs_updated_at BEFORE UPDATE ON public.ai_outputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 索引优化说明

- **用户相关查询**：所有表都有 `user_id` 索引，支持快速查询用户的所有数据
- **全文检索**：`notes` 表使用 GIN 索引支持全文检索
- **关联查询**：外键字段都有索引，优化 JOIN 查询
- **排序查询**：`notes` 表有 `created_at DESC` 索引，支持按时间倒序查询
- **状态筛选**：`notes` 表有 `status` 索引，支持快速筛选

### 数据类型说明

- **UUID**：使用 PostgreSQL 的 `gen_random_uuid()` 生成唯一 ID
- **TIMESTAMPTZ**：带时区的时间戳，便于处理不同时区
- **ENUM**：使用 PostgreSQL ENUM 类型确保数据一致性（content_type, note_status）
- **JSONB**：用于存储结构化数据（key_questions 数组、range_data 对象）
- **TEXT**：用于存储可变长度的文本内容
- **INTEGER**：用于存储数字（时长、位置等）

## Core Workflows
### 1) Capture & Ingest（采集入库）
- 用户提交 `sourceUrl`（粘贴/输入/分享）。
- 系统创建 `Note`（立即可见，避免等待）。
- 异步执行“抓取与解析”：
  - 成功：填充 `title/siteName/contentHtml/contentText/...`
  - 失败：保留 `sourceUrl` 与最小元信息，允许用户稍后重试。

### 2) AI Summarize（AI 摘要与关键问题）
- 触发条件（MVP 建议）：
  - 解析成功后自动触发；或用户手动点击"AI 解读"
- 输入（根据内容类型）：
  - **图文内容**：`title + contentText`（或 `excerpt` 兜底）
  - **视频内容**：`title + videoUrl` → 提取字幕/转录 → 转录文本
  - **音频内容**：`title + audioUrl` → 语音转文字（STT）→ 转录文本
- 处理流程：
  - 视频：使用视频字幕提取API或视频理解API获取转录文本，然后对转录文本进行总结
  - 音频：使用语音转文字API（如 Whisper）获取转录文本，然后对转录文本进行总结
  - 图文：直接对文本内容进行总结
- 输出写入 `AIOutput`：
  - `summary`
  - `keyQuestions[]`
  - `transcript`（可选：视频/音频的转录文本，用于后续检索）
- 失败处理：
  - 不阻塞阅读/标注；提供重试与关闭 AI 的开关（取决于隐私/成本策略）
  - 视频/音频转录失败时，可降级为仅使用标题和元信息生成简要摘要

### 3) Read & Annotate（阅读与标注）
- 阅读器渲染 `contentHtml`；若缺失则展示跳转原文与最小信息。
- 用户选中文本创建 `Highlight`；可附加 `Annotation`。

### 4) Organize & Retrieve（整理与检索）
- 用户将条目归档到收藏夹、添加/移除标签、按状态筛选。
- 检索优先基于 `title/contentText/tags` 做全文检索；AI 全库问答作为后续扩展。

### 5) Share（分享）
- 分享对象：
  - 原文链接 + 标题/站点名
  - 可选：分享高亮引用（quote + note link）
- MVP 建议先实现：
  - 复制链接/复制引用卡片文本
  - 生成公开分享链接（如有鉴权需求，可加 token）

## Architectural Decisions（建议）
- **技术栈**：
  - 前端：Next.js（App Router）+ shadcn/ui 组件库
  - 后端：Supabase（PostgreSQL、Row Level Security、Storage、Edge Functions）
  - AI 处理：Supabase Edge Functions 调用第三方 AI API（如 OpenAI、Anthropic 等）
  - 视频/音频处理：
    - 视频字幕提取：YouTube Data API、Bilibili API 或通用视频字幕提取服务
    - 语音转文字：OpenAI Whisper API、Google Speech-to-Text 或其他 STT 服务
    - 视频理解：可选使用视频理解API（如 Google Video Intelligence API）直接生成摘要
- **异步管线**：采集→解析→AI 生成均应支持异步，以保证界面响应与可恢复性。
  - 使用 Supabase Edge Functions 处理内容抓取与 AI 生成任务
  - 使用 Supabase Realtime 或轮询更新前端状态
- **可降级**：解析/AI 任一步失败，不影响核心"收藏入库 + 后续整理"。
- **可观察性**：记录解析失败原因与 AI 失败原因，便于迭代。
- **扩展点**：
  - 采集入口：浏览器扩展、移动端分享、邮件转发等
  - AI：模型供应商切换、提示词版本管理、批量处理
  - 检索：Supabase 全文索引、向量扩展（pgvector）为 RAG 问答预留

## Risks / Trade-offs
- **内容抓取合规与反爬**：MVP 仅保证基本抓取与失败兜底；后续需明确版权、robots、用户授权等策略。
- **隐私与数据安全**：AI 处理可能涉及外部模型；需明确用户可控与数据删除能力（见 proposal Open Questions）。
- **标注选区定位**：HTML 结构变化可能导致 range 失效；MVP 可优先存 quote 并尽力定位，允许用户手动修复。

## Migration Plan
无（新增能力与数据对象；若后续引入向量索引/全文索引，需单独变更说明）。

## Open Questions
- 采集入口：URL 保存 vs 浏览器扩展/Share Sheet 的最低要求
- AI：云端/本地、自建/第三方、是否支持用户关闭与删除 AI 产物
- 分享：是否必须提供“公开链接”，以及公开内容的权限策略（仅链接可见/需登录/可设置密码）


