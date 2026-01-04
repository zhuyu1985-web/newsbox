# Design Document: 沉浸式新闻笔记阅读详情页

## Context

当前系统的笔记详情页（`/notes/[id]`）功能简单，仅展示基础内容。随着产品定位转向"第二大脑"工作台，需要一个功能丰富的阅读界面，支持图文深度阅读和视频深度分析两种模式，集成AI辅助、批注系统、存档功能等。

**约束：**
- 必须使用Next.js App Router
- 后端使用Supabase（数据库 + Storage + Auth）
- 前端组件基于shadcn/ui + Radix UI
- 需要集成OpenAI、腾讯云ASR、Jina Reader等第三方服务
- 成本敏感：ASR和存储需要严格控制用量

**利益相关方：**
- 终端用户：记者、研究人员、知识工作者
- 产品：核心竞争力功能
- 开发：需要模块化、可维护的架构

## Goals / Non-Goals

### Goals

1. **多态内容渲染**：根据content_type自动切换图文/视频模式
2. **沉浸式阅读体验**：三栏布局、禅模式、个性化设置
3. **深度批注能力**：高亮、笔记、浮顶卡片、视频批注
4. **AI辅助理解**：多视角分析、追问对话、智能章节
5. **证据留存**：网页存档、截图、引用规范
6. **跨设备同步**：阅读进度、偏好设置云端存储
7. **性能优化**：大文件流畅渲染、懒加载、代码分割

### Non-Goals

1. **实时协作**：多人同时批注（V2考虑）
2. **离线阅读**：PWA离线缓存（V2考虑）
3. **PDF批注**：仅支持网页和视频（PDF可V2）
4. **OCR识别**：图片文字识别（V2考虑）
5. **多语言翻译**：内置翻译功能（用户可用浏览器插件）

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js App)                      │
├─────────────────────────────────────────────────────────────┤
│  Reader Page (/notes/[id]/read)                              │
│  ┌──────────┬─────────────────────┬──────────────────────┐  │
│  │  Left    │   Content Stage     │   Right Sidebar      │  │
│  │ Sidebar  │                     │                      │  │
│  │          │  ┌───────────────┐  │  ┌────────────────┐ │  │
│  │ Outline/ │  │  Article      │  │  │  Annotations   │ │  │
│  │ Chapters │  │  or           │  │  │  AI Analysis   │ │  │
│  │          │  │  Video Player │  │  │  Transcript    │ │  │
│  │          │  └───────────────┘  │  └────────────────┘ │  │
│  └──────────┴─────────────────────┴──────────────────────┘  │
│                                                               │
│  Global Header (ViewSwitcher | Appearance | Actions)         │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │  Supabase    │    │  OpenAI API  │    │ Tencent ASR  │
    │  (DB+Storage)│    │              │    │              │
    └──────────────┘    └──────────────┘    └──────────────┘
           │                    │                    │
           └────────────────────┴────────────────────┘
                            │
                    ┌──────────────┐
                    │  Jina Reader │
                    │  (Optional)  │
                    └──────────────┘
```

### Component Hierarchy

```
ReaderPageWrapper (Server Component)
└── ReaderLayout (Client Component)
    ├── GlobalHeader
    │   ├── Breadcrumb & BackButton
    │   ├── ViewSwitcher (Tabs)
    │   ├── AppearanceMenu (Dropdown)
    │   └── ActionMenu (Dropdown)
    ├── MainContainer (3-column grid)
    │   ├── LeftSidebar (conditional)
    │   │   ├── ArticleOutline
    │   │   └── VideoChapters
    │   ├── ContentStage
    │   │   ├── ArticleReader (content_type=article)
    │   │   │   ├── MetaHeader
    │   │   │   ├── ContentRenderer
    │   │   │   └── SelectionMenu (Portal)
    │   │   ├── VideoPlayer (content_type=video)
    │   │   │   ├── PlayerContainer
    │   │   │   └── PlayerControls
    │   │   ├── WebView (iframe)
    │   │   ├── AIBriefView
    │   │   └── ArchiveView
    │   └── RightSidebar (Tabs)
    │       ├── AnnotationList
    │       │   └── AnnotationCard[]
    │       ├── AIAnalysisPanel
    │       │   ├── SummarySection
    │       │   ├── JournalistView
    │       │   ├── TimelineView
    │       │   └── ChatInput
    │       └── TranscriptView (video only)
    │           └── TranscriptSegment[]
    └── FloatingAnnotation[] (Portal, global)
```

## Key Decisions

### Decision 1: 路由结构 - `/notes/[id]/read` vs `/notes/[id]`

**选择：** 创建新路由 `/notes/[id]/read`，保留原有 `/notes/[id]` 作为简化版或重定向。

**理由：**
- **清晰语义**：`/read` 明确表示这是沉浸式阅读模式
- **向后兼容**：不破坏现有链接和书签
- **灵活迭代**：可以保留原页面作为快速预览，新页面作为深度阅读
- **代码隔离**：避免在原有组件上堆叠功能，保持代码清晰

**替代方案：**
- 直接改造 `/notes/[id]`：会破坏现有功能，风险高
- 使用查询参数 `/notes/[id]?mode=immersive`：URL不够语义化

### Decision 2: 多态内容渲染策略

**选择：** 使用条件渲染 + 组件懒加载。

```typescript
// Pseudo code
const ContentStage = ({ note, view }) => {
  if (view === 'reader') {
    return note.content_type === 'video' 
      ? <VideoPlayer note={note} />
      : <ArticleReader note={note} />;
  }
  if (view === 'web') return <WebView url={note.source_url} />;
  if (view === 'ai-brief') return <AIBriefView noteId={note.id} />;
  if (view === 'archive') return <ArchiveView noteId={note.id} />;
};
```

**理由：**
- **简单直观**：易于理解和维护
- **按需加载**：使用 `dynamic()` 懒加载大组件（VideoPlayer、WebView）
- **类型安全**：TypeScript能正确推断类型

**替代方案：**
- 策略模式（工厂函数）：过度设计，不适合React
- 多页面路由：URL复杂，状态管理困难

### Decision 3: 批注数据结构

**选择：** 扩展现有 `highlights` 和 `annotations` 表，增加 `timecode` 和 `screenshot_url` 字段。

```sql
-- highlights表
ALTER TABLE highlights ADD COLUMN timecode INTEGER; -- 视频时间戳(秒)
ALTER TABLE highlights ADD COLUMN screenshot_url TEXT; -- 视频截帧URL

-- annotations表  
ALTER TABLE annotations ADD COLUMN timecode INTEGER;
ALTER TABLE annotations ADD COLUMN screenshot_url TEXT;
```

**理由：**
- **复用现有结构**：减少数据迁移复杂度
- **向后兼容**：图文批注不使用这些字段（NULL）
- **查询效率**：可以用同一个查询获取所有批注

**替代方案：**
- 创建独立 `video_annotations` 表：查询复杂，需要UNION
- 使用JSONB存储额外字段：查询和索引效率低

### Decision 4: ASR转写时机

**选择：** 用户手动触发 + 后台异步处理。

**流程：**
1. 用户点击"生成逐字稿"按钮
2. 前端调用 `/api/transcribe`，立即返回 `{ taskId, status: 'pending' }`
3. 后端异步调用腾讯云ASR，结果写入 `transcripts` 表
4. 前端轮询或使用Supabase Realtime监听状态变化
5. 转写完成后自动显示

**理由：**
- **成本控制**：避免自动转写所有视频（成本高）
- **用户控制**：让用户决定哪些视频值得转写
- **异步处理**：长视频转写可能耗时数分钟，不能阻塞UI

**替代方案：**
- 自动转写所有视频：成本不可控
- 同步等待转写完成：用户体验差，可能超时

### Decision 5: 网页存档策略

**选择：** 使用无头浏览器（Puppeteer）生成单文件HTML + 截图，存储到Supabase Storage。

**存储结构：**
```
supabase-storage://archives/
  ├── {noteId}/
  │   ├── snapshot.html      # 单文件HTML（内联CSS/图片）
  │   └── screenshot.png     # 全页截图
```

**理由：**
- **离线可用**：单文件HTML包含所有资源
- **证据效力**：截图提供视觉证据
- **节省存储**：单文件比完整资源包小
- **隐私保护**：不依赖第三方存档服务

**替代方案：**
- 使用archive.org API：依赖外部服务，不可控
- 仅保存HTML源码：外部资源可能失效
- 使用MHTML格式：浏览器兼容性差

### Decision 6: AI解读数据结构

**选择：** 扩展 `ai_outputs` 表，使用JSONB存储结构化分析结果。

```sql
ALTER TABLE ai_outputs 
  ADD COLUMN journalist_view JSONB,  -- {reliability, stakeholders, bias}
  ADD COLUMN timeline JSONB,         -- [{time, event, source}]
  ADD COLUMN visual_summary JSONB,   -- (视频)关键帧分析
  ADD COLUMN deepfake_warning JSONB; -- (视频)AI生成检测
```

**理由：**
- **灵活结构**：JSONB适合存储非固定schema的AI输出
- **查询能力**：PostgreSQL的JSONB支持高效查询和索引
- **扩展性**：未来添加新分析类型无需修改schema

**替代方案：**
- 单独创建多个表：过度规范化，查询复杂
- 存储为纯文本：无法查询和结构化展示

### Decision 7: 阅读器设置存储

**选择：** 全局设置 + 单篇覆盖。

- **全局设置**：存储在 `user_settings` 表
- **单篇覆盖**：存储在 `notes` 表的JSONB字段 `reader_preferences`

**优先级：** 单篇覆盖 > 全局设置 > 系统默认

**理由：**
- **用户期望**：大多数时候用统一设置，特殊文章（如代码文章需等宽字体）可单独设置
- **存储效率**：大多数notes不需要单独设置（NULL）

**替代方案：**
- 仅localStorage：跨设备不同步
- 仅数据库全局设置：无法单篇定制
- 单独 `note_settings` 表：过度设计

## Data Models

### New Tables

#### web_archives
```sql
CREATE TABLE web_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  snapshot_url TEXT NOT NULL,      -- Supabase Storage URL
  screenshot_url TEXT,              -- 全页截图
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT web_archives_note_id_unique UNIQUE (note_id)
);

CREATE INDEX idx_web_archives_user_id ON web_archives(user_id);
CREATE INDEX idx_web_archives_note_id ON web_archives(note_id);
```

#### video_chapters
```sql
CREATE TABLE video_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  start_time INTEGER NOT NULL,     -- 秒
  end_time INTEGER,
  position INTEGER NOT NULL,        -- 章节顺序
  
  -- AI生成相关
  generated_by_ai BOOLEAN DEFAULT TRUE,
  confidence_score REAL,            -- 0-1
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_chapters_note_id ON video_chapters(note_id);
CREATE INDEX idx_video_chapters_note_id_position ON video_chapters(note_id, position);
```

#### transcripts
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  full_text TEXT NOT NULL,
  segments JSONB NOT NULL,          -- [{start, end, text, speaker}]
  
  -- ASR元数据
  language TEXT DEFAULT 'zh-CN',
  provider TEXT DEFAULT 'tencent',  -- tencent, openai-whisper
  audio_duration INTEGER,           -- 音频时长(秒)
  
  -- 状态
  status TEXT DEFAULT 'completed',  -- pending, processing, completed, failed
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT transcripts_note_id_unique UNIQUE (note_id)
);

CREATE INDEX idx_transcripts_note_id ON transcripts(note_id);
CREATE INDEX idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);
```

#### reading_progress
```sql
CREATE TABLE reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  scroll_position INTEGER DEFAULT 0,  -- px
  scroll_percentage REAL DEFAULT 0,   -- 0-100
  video_position INTEGER,              -- 视频播放位置(秒)
  
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  read_count INTEGER DEFAULT 1,
  total_read_time INTEGER DEFAULT 0,   -- 累计阅读时长(秒)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT reading_progress_user_note_unique UNIQUE (user_id, note_id)
);

CREATE INDEX idx_reading_progress_user_id ON reading_progress(user_id);
CREATE INDEX idx_reading_progress_note_id ON reading_progress(note_id);
CREATE INDEX idx_reading_progress_last_read_at ON reading_progress(last_read_at DESC);
```

#### user_settings
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 阅读器设置
  reader_preferences JSONB DEFAULT '{
    "fontSize": 16,
    "lineHeight": 1.8,
    "fontFamily": "system",
    "theme": "auto",
    "maxWidth": 800,
    "margin": "comfortable"
  }'::jsonb,
  
  -- 视频设置
  video_preferences JSONB DEFAULT '{
    "subtitleSize": 16,
    "subtitleOpacity": 0.9,
    "defaultSpeed": 1.0,
    "autoplay": false
  }'::jsonb,
  
  -- AI设置
  ai_preferences JSONB DEFAULT '{
    "autoGenerate": true,
    "language": "zh-CN"
  }'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

### Extended Tables

```sql
-- notes表扩展
ALTER TABLE notes 
  ADD COLUMN reading_position INTEGER DEFAULT 0,
  ADD COLUMN read_percentage REAL DEFAULT 0,
  ADD COLUMN estimated_read_time INTEGER,        -- 预估阅读时间(分钟)
  ADD COLUMN reader_preferences JSONB;           -- 单篇覆盖设置

-- ai_outputs表扩展
ALTER TABLE ai_outputs
  ADD COLUMN journalist_view JSONB,
  ADD COLUMN timeline JSONB,
  ADD COLUMN visual_summary JSONB,
  ADD COLUMN deepfake_warning JSONB;

-- highlights表扩展（支持视频批注）
ALTER TABLE highlights
  ADD COLUMN timecode INTEGER,                   -- 视频时间戳
  ADD COLUMN screenshot_url TEXT;                -- 视频截帧

-- annotations表扩展
ALTER TABLE annotations
  ADD COLUMN timecode INTEGER,
  ADD COLUMN screenshot_url TEXT;
```

## API Design

### POST /api/ai/analyze

生成多视角AI分析。

**Request:**
```typescript
{
  noteId: string;
  perspectives: ('summary' | 'journalist' | 'timeline' | 'visual')[];
}
```

**Response:**
```typescript
{
  summary: string;
  journalistView?: {
    reliability: string;
    stakeholders: string[];
    bias: string;
  };
  timeline?: Array<{
    time: string;
    event: string;
    source: string;
  }>;
  visualSummary?: {
    keyFrames: string[];
    scenes: string[];
  };
}
```

### POST /api/ai/chat

AI追问对话（RAG）。

**Request:**
```typescript
{
  noteId: string;
  message: string;
  conversationHistory?: Array<{role: 'user' | 'assistant'; content: string}>;
}
```

**Response:** Server-Sent Events (流式)
```
data: {"chunk": "这篇文章主要讨论..."}
data: {"chunk": "从经济学角度..."}
data: {"done": true}
```

### POST /api/transcribe

视频/音频转写（腾讯云ASR）。

**Request:**
```typescript
{
  noteId: string;
  audioUrl?: string;  // 可选，不提供则从note中提取
}
```

**Response:**
```typescript
{
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptId?: string;  // 完成后返回
}
```

**Polling Endpoint:** `GET /api/transcribe/status/:taskId`

### POST /api/archive/create

创建网页快照。

**Request:**
```typescript
{
  noteId: string;
  url: string;
}
```

**Response:**
```typescript
{
  archiveId: string;
  snapshotUrl: string;
  screenshotUrl: string;
  fileSize: number;
}
```

### POST /api/chapters/generate

AI生成视频章节。

**Request:**
```typescript
{
  noteId: string;
  transcriptId?: string;  // 可选，基于已有逐字稿生成
}
```

**Response:**
```typescript
{
  chapters: Array<{
    title: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}
```

### PUT /api/reading-progress/:noteId

更新阅读进度（批量/节流）。

**Request:**
```typescript
{
  scrollPosition?: number;
  scrollPercentage?: number;
  videoPosition?: number;
  readTime?: number;  // 增量时长(秒)
}
```

**Response:**
```typescript
{
  success: boolean;
}
```

## Technology Choices

### Frontend

| 需求 | 技术选择 | 理由 |
|------|----------|------|
| 路由 | Next.js App Router | 项目标准，SSR支持 |
| UI组件 | shadcn/ui + Radix UI | 已有基础，Radix提供高级组件 |
| 状态管理 | React Context + hooks | 复杂度适中，无需Redux |
| 视频播放 | video.js | 功能完善，插件丰富 |
| 文本渲染 | react-markdown | Markdown支持 |
| 代码高亮 | shiki | 性能优于Prism，主题丰富 |
| 划词选择 | Selection API | 原生API，无依赖 |
| 虚拟滚动 | react-window | 性能最优 |

### Backend

| 需求 | 技术选择 | 理由 |
|------|----------|------|
| 数据库 | Supabase PostgreSQL | 项目标准 |
| 存储 | Supabase Storage | 项目标准，集成简单 |
| AI | OpenAI GPT-4 | 质量最高 |
| ASR | 腾讯云ASR | 中文识别准确率高，成本适中 |
| 内容提取 | Jina Reader API | 质量高于Readability |
| 网页快照 | Puppeteer | 无头浏览器，功能最全 |

### Infrastructure

- **部署**: Vercel (Next.js最佳)
- **CDN**: Vercel Edge Network
- **监控**: Vercel Analytics + Sentry
- **日志**: Vercel Logs + Supabase Logs

## Security Considerations

### XSS Prevention

1. **内容渲染**：
   - 使用 `DOMPurify` sanitize HTML
   - React自动转义文本内容
   - iframe使用 `sandbox` 属性

2. **CSP策略**：
```typescript
// next.config.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  frame-src 'self' https://www.youtube.com https://player.bilibili.com;
`;
```

### CSRF Protection

- Next.js自带CSRF保护
- 所有POST请求验证Origin header
- 敏感操作（删除、转写）二次确认

### Rate Limiting

- API路由使用rate-limit中间件
- ASR API：每用户每小时最多10次
- AI API：每用户每分钟最多5次
- 存档创建：每用户每天最多50次

### Data Privacy

- 用户数据通过RLS隔离
- 存档文件URL使用signed URL（有效期7天）
- 敏感API密钥存储在环境变量

## Performance Optimization

### Code Splitting

```typescript
// 懒加载大组件
const VideoPlayer = dynamic(() => import('@/components/reader/VideoPlayer'), {
  loading: () => <VideoPlayerSkeleton />,
  ssr: false,
});

const WebView = dynamic(() => import('@/components/reader/WebView'), {
  ssr: false,
});
```

### Virtual Scrolling

```typescript
// 长文本使用react-window
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={800}
  itemCount={paragraphs.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>{paragraphs[index]}</div>
  )}
</FixedSizeList>
```

### Image Optimization

- 使用Next.js `<Image>` 组件
- 懒加载（IntersectionObserver）
- WebP格式优先
- 响应式图片（srcset）

### Caching Strategy

- **API Routes**: 
  - GET请求使用stale-while-revalidate
  - 转写结果缓存30天
  - AI分析结果缓存7天

- **Static Assets**:
  - 存档文件：Cache-Control: public, max-age=31536000
  - 截图：Cache-Control: public, max-age=604800

## Migration Plan

### Phase 1: Database Schema (Day 1-2)

1. 运行迁移 `008_add_reader_page_schema.sql`
2. 验证RLS policies
3. 测试数据写入读取

### Phase 2: Basic Layout (Day 3-5)

1. 创建 `/notes/[id]/read` 路由
2. 实现三栏布局组件
3. 实现视图切换器
4. 实现响应式和禅模式

### Phase 3: Article Mode (Day 6-10)

1. 实现 ArticleReader 组件
2. 集成Jina Reader API
3. 实现划词气泡菜单
4. 实现智能大纲

### Phase 4: Annotation System (Day 11-14)

1. 扩展高亮功能（多色、视频时间戳）
2. 实现批注卡片
3. 实现浮顶功能
4. 实现位置恢复算法

### Phase 5: AI Integration (Day 15-19)

1. 实现 `/api/ai/analyze`
2. 实现多视角分析UI
3. 实现 `/api/ai/chat` (流式)
4. 实现追问对话界面

### Phase 6: Video Mode (Day 20-29)

1. 集成video.js播放器
2. 实现 `/api/transcribe`（腾讯云ASR）
3. 实现逐字稿展示（卡拉OK）
4. 实现 `/api/chapters/generate`
5. 实现章节导航
6. 实现视频批注（截帧）

### Phase 7: Web Archive (Day 30-33)

1. 实现 `/api/archive/create`（Puppeteer）
2. 配置Supabase Storage bucket
3. 实现存档查看界面
4. 实现导出功能

### Phase 8: Settings & Progress (Day 34-37)

1. 实现阅读器设置UI
2. 实现设置持久化
3. 实现 `/api/reading-progress`
4. 实现断点续读

### Phase 9: Optimization & Testing (Day 38-40)

1. 性能优化（虚拟滚动、懒加载）
2. 安全加固（CSP、sanitize）
3. 跨浏览器测试
4. 移动端适配
5. E2E测试

## Rollback Plan

如果上线后出现严重问题：

1. **数据库**：保留旧schema，新表和字段可以为空
2. **路由**：`/notes/[id]` 保持不变，移除 `/notes/[id]/read`
3. **API**：新增API可直接下线，不影响旧功能

**回滚步骤：**
```bash
# 1. 回滚代码
git revert <commit-hash>
git push

# 2. 数据库无需回滚（新表不影响旧功能）

# 3. 清理Supabase Storage（可选）
# 删除archives bucket中的文件
```

## Open Questions

1. **ASR质量**：腾讯云ASR对方言、专业术语的识别准确率如何？是否需要备选方案？
   - **计划**：先用少量视频测试，准确率<80%考虑增加人工校对流程

2. **存档合规性**：保存网页快照是否涉及版权问题？
   - **计划**：咨询法务，可能需要在快照中添加免责声明和原文链接

3. **成本预算**：ASR+存储+AI的月度成本预估？
   - **计划**：
     - ASR: ¥0.25/分钟 × 预估1000分钟/月 = ¥250
     - 存储: 100GB × ¥0.021/GB = ¥2.1
     - AI: OpenAI API $0.03/1k tokens × 预估100万tokens = $30
     - **总计**: 约¥500/月（初期）

4. **移动端体验**：三栏布局在手机上如何展示？
   - **计划**：
     - <768px: 单栏，通过Tab切换内容/批注/AI
     - 左右侧栏改为全屏抽屉
     - 划词菜单改为长按触发

5. **实时同步**：多设备同时阅读时，进度如何同步？
   - **计划**：使用Supabase Realtime，5秒节流更新一次

## Success Metrics

### Technical KPIs

- **页面加载时间**: <2s (p95)
- **Time to Interactive**: <3s (p95)
- **大文件渲染**: 10000字文章 60fps
- **API响应时间**: <500ms (p95)
- **错误率**: <0.1%

### Business KPIs

- **使用率**: 60%用户使用新阅读页
- **批注创建**: 平均每篇3条批注
- **AI解读触发**: 40%文章生成AI分析
- **阅读完成率**: 从30%提升至50%
- **留存提升**: DAU +15%

### User Satisfaction

- **NPS**: >50
- **功能满意度**: >4.5/5
- **性能满意度**: >4.0/5

