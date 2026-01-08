# Technical Design: Jina Reader 爬虫集成与内容格式化

## Context

当前系统使用 Node.js fetch + Cheerio 实现基础网页内容抓取，存在成功率低、内容质量不稳定的问题。用户已配置 `JINA_API_KEY` 环境变量，希望集成 Jina Reader API 提升抓取能力，并统一内容格式化展现。

### 当前架构
```
用户提交 URL
    ↓
app/api/capture/route.ts (验证权限)
    ↓
fetch(url) + cheerio 解析
    ↓
html-sanitizer.ts (基础清理)
    ↓
保存到 Supabase notes 表
```

### 目标架构
```
用户提交 URL
    ↓
app/api/capture/route.ts (验证权限)
    ↓
检测内容类型（视频/文章）
    ├─ 视频 → 保留原逻辑（提取 embed URL）
    └─ 文章 → Jina Reader API
        ↓
    格式化处理器（新闻样式）
        ↓
    保存到 Supabase notes 表
```

## Goals / Non-Goals

### Goals
- ✅ 集成 Jina Reader API 作为主要抓取引擎
- ✅ 实现统一的新闻详情页格式化处理
- ✅ 应用 `docs/tec-news-reader-style.md` 中定义的样式规范
- ✅ 保持向后兼容（现有笔记不受影响）
- ✅ 支持降级：Jina Reader 失败时保留 URL

### Non-Goals
- ❌ 不实现 Puppeteer 方案（未来可扩展）
- ❌ 不修改数据库 schema（使用现有字段）
- ❌ 不改变视频平台检测逻辑
- ❌ 不处理登录墙/付费墙（Jina Reader 能力限制）

## Decisions

### Decision 1: 使用 Jina Reader API 官方 r.jina.ai 端点

**选择理由：**
- 官方端点稳定可靠，有 SLA 保障
- 支持 Markdown 和 HTML 格式返回
- 自动处理反爬、动态加载等复杂场景
- 返回结构化数据（title, description, content）

**API 调用格式：**
```typescript
GET https://r.jina.ai/{url}
Headers:
  Authorization: Bearer {JINA_API_KEY}
  X-Return-Format: markdown  // 或 html
  X-Timeout: 15              // 15秒超时
```

**替代方案（未采用）：**
- 自建 Jina Reader 服务：需要额外服务器，维护成本高
- 使用 Jina Reader npm 包：需要浏览器环境，不适合 serverless

### Decision 2: 返回 Markdown 格式后转换为 HTML

**选择理由：**
- Markdown 更简洁，便于后续处理
- 可以使用 `marked` 或 `remark` 库高质量转换为 HTML
- 避免 Jina 返回的原始 HTML 中可能存在的冗余标签

**转换流程：**
```
Jina Reader API → Markdown
    ↓
marked 库转换 → HTML
    ↓
html-sanitizer.ts 清理 → 干净的 HTML
    ↓
应用新闻样式类 → 最终展示内容
```

**替代方案（未采用）：**
- 直接使用 HTML 格式：可能包含冗余标签，需要额外清理

### Decision 3: 视频内容保持原有检测逻辑

**选择理由：**
- 视频平台（B站、YouTube 等）检测逻辑已经稳定
- Jina Reader 对视频页面的提取价值有限
- embed URL 生成逻辑无需改变

**处理流程：**
```typescript
if (isVideoURL(url)) {
  // 保留原有逻辑：检测平台 → 生成 embed URL
  return handleVideoCapture(url);
} else {
  // 使用 Jina Reader 抓取文章内容
  return handleArticleCapture(url);
}
```

### Decision 4: 格式化处理应用 Tailwind Prose 类

**选择理由：**
- 项目已使用 Tailwind CSS 和 `@tailwindcss/typography`
- `docs/tec-news-reader-style.md` 中的样式可以映射为 Tailwind 类
- 避免额外的 CSS 文件，保持一致性

**样式映射：**
```
新闻样式规范                → Tailwind Prose 类
─────────────────────────────────────────────
标题 28px bold              → prose-h1:text-[28px] prose-h1:font-bold
正文 18px line-height 1.8   → prose-p:text-[18px] prose-p:leading-[1.8]
段落间距 24px               → prose-p:mb-[24px]
图片居中 + 阴影             → prose-img:mx-auto prose-img:shadow-md
引用左边框 + 背景           → prose-blockquote:border-l-4 prose-blockquote:bg-blue-50
```

**优化后的 CONTENT_STYLING_CLASSES：**
```typescript
export const NEWS_STYLING_CLASSES =
  "prose prose-slate max-w-none dark:prose-invert " +
  // 标题样式（符合新闻规范）
  "prose-h1:text-[28px] prose-h1:font-bold prose-h1:leading-[1.3] prose-h1:mb-4 " +
  "prose-h2:text-[20px] prose-h2:font-semibold prose-h2:mb-3 " +
  // 正文样式
  "prose-p:text-[18px] prose-p:leading-[1.8] prose-p:mb-6 " +
  // 图片样式
  "prose-img:rounded prose-img:shadow-md prose-img:mx-auto prose-img:my-8 " +
  // 引用样式
  "prose-blockquote:border-l-4 prose-blockquote:border-blue-500 " +
  "prose-blockquote:bg-blue-50/50 prose-blockquote:py-3 prose-blockquote:px-4 " +
  // 列表样式
  "prose-li:mb-3 prose-li:leading-[1.7]";
```

## Architecture

### 组件关系图
```
┌─────────────────────────────────────────────────┐
│  app/api/capture/route.ts (API 入口)            │
│  - 验证用户权限                                  │
│  - 检测内容类型（视频/文章）                     │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐      ┌──────────────────────────┐
│ 视频逻辑 │      │ lib/services/jina-reader.ts│
│ (保留)   │      │ - 调用 Jina Reader API    │
└─────────┘      │ - 返回 Markdown/HTML      │
                 │ - 错误处理与重试           │
                 └────────┬─────────────────┘
                          │
                          ▼
                 ┌─────────────────────────────┐
                 │ lib/services/html-sanitizer.ts│
                 │ - Markdown → HTML 转换      │
                 │ - 清理标签和属性             │
                 │ - 应用新闻样式类             │
                 └────────┬──────────────────┘
                          │
                          ▼
                 ┌─────────────────────┐
                 │ Supabase notes 表    │
                 │ - content_html      │
                 │ - content_text      │
                 │ - title, excerpt    │
                 └─────────────────────┘
```

### 数据流
```typescript
// 1. API 接收请求
POST /api/capture
Body: { noteId, url }

// 2. 检测内容类型
const urlObj = new URL(url);
if (isVideoURL(urlObj)) {
  // 视频逻辑（保留）
  return handleVideoCapture(url);
}

// 3. 调用 Jina Reader
const jinaResult = await extractWithJinaReader(url, {
  returnFormat: 'markdown',
  timeout: 15
});
// 返回：{ title, description, content (Markdown) }

// 4. 转换为 HTML
const contentHtml = markdownToHtml(jinaResult.content);

// 5. 清理和格式化
const cleanHtml = sanitizeAndFormatNewsContent(contentHtml);

// 6. 保存到数据库
await supabase.from('notes').update({
  title: jinaResult.title,
  excerpt: jinaResult.description,
  content_html: cleanHtml,
  content_text: extractText(cleanHtml),
  captured_at: new Date().toISOString()
}).eq('id', noteId);
```

### 错误处理流程
```
Jina Reader API 调用
    ↓
成功？
    ├─ 是 → 格式化内容 → 保存
    └─ 否 → 记录错误
        ↓
    API 超时/网络错误？
        ├─ 是 → 返回 { success: false, error: 'timeout' }
        └─ 否 → API 返回错误
            ↓
        检查错误类型
            ├─ 401/403 → 'API key invalid'
            ├─ 429 → 'Rate limit exceeded'
            ├─ 500 → 'Jina Reader service error'
            └─ 其他 → 'Unknown error'
```

## Implementation Details

### 1. Jina Reader 服务封装

**文件：** `lib/services/jina-reader.ts`

```typescript
/**
 * Jina Reader API 响应接口
 */
export interface JinaReaderResult {
  title: string;
  description: string;
  content: string;  // Markdown 格式
  url: string;
  siteName?: string;
  author?: string;
  publishedTime?: string;
}

/**
 * 调用 Jina Reader API 提取网页内容
 *
 * @param url - 目标 URL
 * @param options - 可选配置
 * @returns 提取的内容
 */
export async function extractWithJinaReader(
  url: string,
  options?: {
    returnFormat?: 'markdown' | 'html';
    timeout?: number;
  }
): Promise<JinaReaderResult> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error('JINA_API_KEY is not configured');
  }

  const returnFormat = options?.returnFormat || 'markdown';
  const timeout = options?.timeout || 15;

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Return-Format': returnFormat,
        'X-Timeout': timeout.toString(),
      },
      signal: AbortSignal.timeout(timeout * 1000),
    });

    if (!response.ok) {
      throw new Error(`Jina Reader API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      title: data.data.title || '',
      description: data.data.description || '',
      content: data.data.content || '',
      url: data.data.url || url,
      siteName: data.data.siteName,
      author: data.data.author,
      publishedTime: data.data.publishedTime,
    };
  } catch (error: any) {
    console.error('Jina Reader extraction failed:', error);
    throw error;
  }
}
```

### 2. 内容格式化增强

**文件：** `lib/services/html-sanitizer.ts`

新增函数：
```typescript
import { marked } from 'marked';

/**
 * 将 Markdown 转换为 HTML 并应用新闻样式
 */
export function formatNewsContent(markdown: string): string {
  // 1. Markdown → HTML
  const rawHtml = marked(markdown);

  // 2. 清理 HTML（复用现有函数）
  const cleanHtml = sanitizeHtmlContent(rawHtml);

  // 3. 应用新闻样式类（在前端使用）
  return cleanHtml;
}

/**
 * 新闻样式 Tailwind 类（用于前端）
 */
export const NEWS_STYLING_CLASSES =
  "prose prose-slate max-w-none dark:prose-invert " +
  "prose-h1:text-[28px] prose-h1:font-bold prose-h1:leading-[1.3] prose-h1:mb-4 " +
  "prose-h2:text-[20px] prose-h2:font-semibold prose-h2:leading-[1.4] prose-h2:mb-3 " +
  "prose-p:text-[18px] prose-p:leading-[1.8] prose-p:mb-6 " +
  "prose-img:rounded prose-img:shadow-md prose-img:mx-auto prose-img:my-8 " +
  "prose-blockquote:border-l-4 prose-blockquote:border-blue-500 " +
  "prose-blockquote:bg-blue-50/50 prose-blockquote:py-3 prose-blockquote:px-4 " +
  "prose-li:mb-3 prose-li:leading-[1.7]";
```

### 3. Capture API 更新

**文件：** `app/api/capture/route.ts`

主要修改：
```typescript
import { extractWithJinaReader } from '@/lib/services/jina-reader';
import { formatNewsContent } from '@/lib/services/html-sanitizer';

// 在 POST 函数中：
// ... 权限验证代码 ...

// 检测视频平台（保留原逻辑）
if (isVideoURL(urlObj)) {
  // 视频处理逻辑保持不变
  return handleVideoCapture(urlObj, noteId);
}

// 使用 Jina Reader 抓取文章内容
try {
  const jinaResult = await extractWithJinaReader(targetUrl, {
    returnFormat: 'markdown',
    timeout: 15
  });

  // 格式化内容
  const contentHtml = formatNewsContent(jinaResult.content);
  const contentText = extractTextFromHtml(contentHtml);

  // 更新笔记
  await supabase.from('notes').update({
    title: jinaResult.title,
    excerpt: jinaResult.description?.substring(0, 200),
    content_html: contentHtml,
    content_text: contentText,
    site_name: jinaResult.siteName || urlObj.hostname,
    author: jinaResult.author,
    published_at: jinaResult.publishedTime,
    captured_at: new Date().toISOString(),
    content_type: 'article'
  }).eq('id', noteId);

  return NextResponse.json({ success: true });
} catch (error) {
  console.error('Jina Reader failed:', error);
  return NextResponse.json({
    success: false,
    error: 'Failed to capture content'
  }, { status: 500 });
}
```

### 4. 前端样式应用

**文件：** `components/reader/ContentStage/ArticleReader.tsx`

```typescript
import { NEWS_STYLING_CLASSES } from '@/lib/services/html-sanitizer';

// 在渲染内容时：
<div
  className={NEWS_STYLING_CLASSES}
  dangerouslySetInnerHTML={{ __html: note.content_html || '' }}
/>
```

## Risks / Trade-offs

### Risk 1: Jina Reader API 依赖性
**影响**：外部服务不可用时无法抓取内容
**缓解**：
- 设置合理的超时时间（15秒）
- 提供清晰的错误提示
- 未来可添加降级到基础爬虫的逻辑

### Risk 2: API 调用成本
**影响**：每次抓取消耗 API 配额，可能产生额外费用
**缓解**：
- 监控 API 使用量
- 设置月度预算告警
- 优化抓取策略（避免重复抓取）

### Risk 3: 格式化可能破坏特殊内容
**影响**：某些复杂排版可能在格式化后显示异常
**缓解**：
- 充分测试各类网站内容
- 保留原始 HTML 在数据库中
- 允许用户切换到"原始网页"视图

### Trade-off 1: Markdown vs HTML
**选择**：使用 Markdown 格式
**优势**：简洁、易处理、体积小
**劣势**：可能丢失部分复杂排版
**决策**：对于新闻文章，Markdown 足够覆盖 95% 场景

### Trade-off 2: 统一样式 vs 保留原样式
**选择**：统一应用新闻样式
**优势**：阅读体验一致、减少样式冲突
**劣势**：失去原网站特色
**决策**：优先阅读体验，保留"原始网页"视图作为备选

## Migration Plan

### Phase 1: 实现核心功能（Day 1-2）
1. 创建 `lib/services/jina-reader.ts`
2. 更新 `app/api/capture/route.ts`
3. 增强 `lib/services/html-sanitizer.ts`
4. 本地测试验证

### Phase 2: 样式优化（Day 3）
1. 定义 NEWS_STYLING_CLASSES
2. 更新 ArticleReader 组件
3. 测试响应式展示

### Phase 3: 部署与监控（Day 4-5）
1. 部署到生产环境
2. 监控 API 调用情况
3. 收集用户反馈

### Rollback Strategy
如果出现问题，执行以下步骤：
1. 回退 `app/api/capture/route.ts`
2. 移除 Jina Reader 依赖
3. 恢复基础爬虫逻辑

## Testing Strategy

### Unit Tests
- `jina-reader.ts` 的 API 调用逻辑
- `html-sanitizer.ts` 的格式化函数
- 错误处理分支覆盖

### Integration Tests
- 完整的抓取流程测试
- 不同类型 URL 的处理
- 视频平台检测保持不变

### Manual Tests
- 测试各类新闻网站
- 验证样式展示效果
- 检查移动端适配

## Open Questions

无（所有技术决策已明确）
