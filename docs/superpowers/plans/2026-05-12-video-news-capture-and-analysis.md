# Video News Capture + AI Analysis Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在浏览器插件中扩展 5 个国内视频平台的抓取能力（抖音/B站/微博/快手/微信视频号），通过 NewsBox 后端把视频字节落到腾讯云 COS，再调阿里通义听悟拿章节/摘要/转写/Q&A、调 Qwen-VL 拿画面理解，最后在 Reader 三栏布局里展示。

**Architecture:** 用户在平台页面点插件保存 → 插件提取直链 + 元数据 → 服务端创建 notes 占位 + video_jobs 记录 → 同进程后台 worker 用状态机推进（下载/COS CI 探测/截帧/听悟分析/Qwen-VL）→ Reader 通过轮询读到 fully_ready 后展示完整数据。Plan A 的 StorageProvider + MediaProcessingCapability 已就绪，本 Plan 在其之上构建 AI 分析层 + worker + 业务 API + UI。

**Tech Stack:** TypeScript, Next.js 15 (App Router), Supabase（DB），Tencent COS（视频字节 + CI 截帧/封面），阿里通义听悟 OpenAPI（音频/文本分析），DashScope Qwen-VL（视觉），Chrome Extension Manifest V3（content script + service worker）

**Spec:** `docs/superpowers/specs/2026-05-12-video-and-storage-design.md` 全文（§4-8 是 Plan B 核心范围）

**Dependency on Plan A:** ✅ 已完成。`getStorageProvider()` / `buildStorageKey()` / `MediaProcessingCapability` 全部就绪。

---

## 文件结构总览

### 新建（按目录分组）

**数据库 migrations:**
| 路径 | 责任 |
|---|---|
| `supabase/migrations/023_add_video_jobs.sql` | video_jobs 表 + RLS |
| `supabase/migrations/024_add_notes_video_fields.sql` | notes 加 video_job_id / video_overall_status / video_ready_at |

**AI 分析层（lib/ai-analysis/）:**
| 路径 | 责任 |
|---|---|
| `lib/ai-analysis/types.ts` | AudioAnalysisResult / VisualAnalysisResult / Provider 接口 |
| `lib/ai-analysis/audio-provider.ts` | getAudioAnalysisProvider() 工厂（首发仅 Tingwu） |
| `lib/ai-analysis/visual-provider.ts` | getVisualAnalysisProvider() 工厂（Qwen-VL） |
| `lib/ai-analysis/adapters/tingwu.ts` | 阿里通义听悟 OpenAPI 适配器 |
| `lib/ai-analysis/adapters/qwen-vl.ts` | DashScope Qwen-VL 多模态适配器 |
| `lib/ai-analysis/qa-service.ts` | 交互式 Q&A（基于 Qwen-Plus + transcript） |
| `lib/ai-analysis/index.ts` | barrel |

**Worker（lib/workers/video-pipeline/）:**
| 路径 | 责任 |
|---|---|
| `lib/workers/video-pipeline/types.ts` | VideoJob row 类型 + 状态枚举 |
| `lib/workers/video-pipeline/db.ts` | DB 访问封装：fetchPending / markX / persistResult |
| `lib/workers/video-pipeline/scheduler.ts` | setInterval 主循环 + 并发上限 |
| `lib/workers/video-pipeline/step-download.ts` | A 路径下载 + COS 上传 |
| `lib/workers/video-pipeline/step-probe-and-cover.ts` | COS CI 探测元信息 + 智能封面 |
| `lib/workers/video-pipeline/step-analyze-audio.ts` | 听悟提交 + 轮询 |
| `lib/workers/video-pipeline/step-extract-frames.ts` | 按章节抽关键帧 |
| `lib/workers/video-pipeline/step-analyze-visual.ts` | Qwen-VL 分析关键帧 |
| `lib/workers/video-pipeline/reconcile.ts` | 汇总 notes.video_overall_status |
| `lib/workers/video-pipeline/recovery.ts` | 启动时续跑 in_progress job |
| `lib/workers/index.ts` | 对外 startVideoWorker() |
| `instrumentation.ts` | Next.js 启动 hook 启动 worker |

**API 路由（app/api/）:**
| 路径 | 责任 |
|---|---|
| `app/api/extension/save-video/route.ts` | A 路径入口：插件提交直链 + 元数据，创建笔记 + job |
| `app/api/extension/video-upload-cred/route.ts` | B 路径：签发 COS 直传凭证 |
| `app/api/extension/video-upload-done/route.ts` | B 路径：插件上传完毕汇报 |
| `app/api/ai/video/ask/route.ts` | 交互式 Q&A |
| `app/api/ai/video/[jobId]/status/route.ts` | 状态轮询 |
| `app/api/ai/video/[jobId]/retry/route.ts` | 用户主动重试 |

**浏览器插件（extension/src/）:**
| 路径 | 责任 |
|---|---|
| `extension/src/content/video-extractors/base.ts` | IVideoExtractor 接口 + VideoCapture 类型 |
| `extension/src/content/video-extractors/index.ts` | 注册表 + matches() 自动派发 |
| `extension/src/content/video-extractors/douyin.ts` | 抖音 mp4 直链提取（A 路径） |
| `extension/src/content/video-extractors/kuaishou.ts` | 快手 |
| `extension/src/content/video-extractors/weibo.ts` | 微博视频 |
| `extension/src/content/video-extractors/bilibili.ts` | B 站 m3u8（B 路径） |
| `extension/src/content/video-extractors/weixin-channel.ts` | 微信视频号（B 路径） |
| `extension/src/background/video-uploader.ts` | B 路径浏览器后台下载 + 分片上传 COS |

**Reader UI（components/reader/）:**
| 路径 | 责任 |
|---|---|
| `components/reader/RightSidebar/QAPanel.tsx` | 听悟预生成 Q&A + 交互式聊天 |
| `components/reader/RightSidebar/VisualFrames.tsx` | 关键帧网格 + 场景描述 + 实体 chips |

**测试（tests/）：**
| 路径 | 责任 |
|---|---|
| `tests/lib/ai-analysis/adapters/tingwu.test.ts` | 听悟 adapter 单测（mock SDK） |
| `tests/lib/ai-analysis/adapters/qwen-vl.test.ts` | Qwen-VL adapter 单测 |
| `tests/lib/ai-analysis/qa-service.test.ts` | Q&A 服务单测 |
| `tests/lib/workers/video-pipeline/db.test.ts` | DB 封装单测 |
| `tests/lib/workers/video-pipeline/scheduler.test.ts` | scheduler 单测（mock DB + steps） |
| `tests/lib/workers/video-pipeline/step-*.test.ts` | 每个 step 一份单测（幂等性、错误重试） |

### 修改

| 路径 | 改动 |
|---|---|
| `components/reader/LeftSidebar/VideoChapters.tsx` | 改读 `video_jobs.audio_result.chapters`，自动渲染章节 + 帧缩略图 |
| `components/reader/RightSidebar/index.tsx` | 改为 Radix Tabs 容器（转写/Q&A/画面/批注） |
| `components/reader/RightSidebar/TranscriptView.tsx` | 增强：显示说话人标签 + 自动滚动到当前播放段 |
| `components/dashboard/dashboard-content.tsx` | 视频笔记卡片增加 video_overall_status 状态指示 + 轮询 |
| `extension/src/popup/App.tsx` | 检测到视频平台时显示"保存视频"按钮 |
| `extension/src/popup/components/SaveView.tsx`（如存在）或新增 VideoSaveView | 视频保存流的 popup UI |
| `extension/src/shared/api.ts` | 加 saveVideo / requestUploadCred / reportUploadDone 三个 API 调用封装 |
| `extension/manifest.json` | host_permissions 增加 5 个平台域名（如未含） |
| `.env.example` | 加 AUDIO_ANALYSIS_PROVIDER / VISUAL_ANALYSIS_PROVIDER / ALI_TINGWU_* / DASHSCOPE_* / VIDEO_WORKER_* |
| `CLAUDE.md` | 指向 lib/ai-analysis 和 lib/workers/video-pipeline |

---

## 实施约束

- **严格 TDD**：所有有逻辑的模块（adapter / step / scheduler / qa-service）先写测试再实现
- **YAGNI**：只实现 spec 范围内功能。比如不要做"自动重新生成 AI 分析"、"导出 transcript"等附加功能。
- **DRY**：listening / polling 模式在每个 step 都重复，封装到 `lib/workers/video-pipeline/db.ts` 的 helper（markPending/markInProgress/markDone/markFailed）
- **频繁 commit**：每个 task 1 个 commit；步骤显式要求 commit 时执行
- **现有图文转存/笔记浏览不能挂**：每 phase 收尾跑一次 `npm run build` 确认不破坏现有路径

---

## Phase 1：后端基础设施（Tasks 1-15）

### Task 1：数据库 migrations

**Files:**
- Create: `supabase/migrations/023_add_video_jobs.sql`
- Create: `supabase/migrations/024_add_notes_video_fields.sql`

- [ ] **Step 1: 写 `023_add_video_jobs.sql`**

```sql
-- supabase/migrations/023_add_video_jobs.sql
CREATE TABLE IF NOT EXISTS video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,

  source_url text NOT NULL,
  platform text NOT NULL,
  source_video_url text NOT NULL,
  request_headers jsonb,
  download_strategy text NOT NULL CHECK (download_strategy IN ('server', 'browser')),

  download_status text NOT NULL DEFAULT 'pending'
    CHECK (download_status IN ('pending', 'in_progress', 'done', 'failed', 'need_browser_fallback')),
  cos_key text,
  cos_url text,
  size_bytes bigint,
  download_error text,

  probe_status text NOT NULL DEFAULT 'pending'
    CHECK (probe_status IN ('pending', 'in_progress', 'done', 'failed')),
  probe_data jsonb,

  cover_status text NOT NULL DEFAULT 'pending'
    CHECK (cover_status IN ('pending', 'in_progress', 'done', 'failed')),
  cover_url text,

  frame_status text NOT NULL DEFAULT 'pending'
    CHECK (frame_status IN ('pending', 'in_progress', 'done', 'failed')),
  frames jsonb,

  audio_status text NOT NULL DEFAULT 'pending'
    CHECK (audio_status IN ('pending', 'in_progress', 'done', 'failed')),
  audio_task_id text,
  audio_result jsonb,
  audio_error text,

  visual_status text NOT NULL DEFAULT 'pending'
    CHECK (visual_status IN ('pending', 'in_progress', 'done', 'failed', 'skipped')),
  visual_result jsonb,
  visual_error text,

  retry_count int NOT NULL DEFAULT 0,
  next_retry_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_active ON video_jobs (updated_at)
  WHERE download_status IN ('pending', 'in_progress')
     OR audio_status    IN ('pending', 'in_progress')
     OR visual_status   IN ('pending', 'in_progress')
     OR probe_status    IN ('pending', 'in_progress')
     OR cover_status    IN ('pending', 'in_progress')
     OR frame_status    IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_note_id ON video_jobs (note_id);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_jobs_user_select" ON video_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "video_jobs_user_insert" ON video_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_jobs_user_update" ON video_jobs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "video_jobs_user_delete" ON video_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 自动触发器（项目其他表通用模式）
CREATE OR REPLACE FUNCTION trigger_set_video_jobs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_video_jobs_timestamp
BEFORE UPDATE ON video_jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_set_video_jobs_timestamp();
```

- [ ] **Step 2: 写 `024_add_notes_video_fields.sql`**

```sql
-- supabase/migrations/024_add_notes_video_fields.sql
ALTER TABLE notes ADD COLUMN IF NOT EXISTS video_job_id uuid REFERENCES video_jobs(id);
ALTER TABLE notes ADD COLUMN IF NOT EXISTS video_ready_at timestamptz;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS video_overall_status text
  CHECK (video_overall_status IN ('processing', 'media_ready', 'fully_ready', 'failed', 'need_browser_fallback'));

CREATE INDEX IF NOT EXISTS idx_notes_video_overall_status
  ON notes (video_overall_status)
  WHERE video_overall_status IS NOT NULL AND video_overall_status != 'fully_ready';
```

- [ ] **Step 3: Smoke 验证 SQL 语法（如有 supabase CLI）**

```bash
# 可选：如有本地 supabase 实例
# supabase db reset --linked  # 危险，本地才用
# supabase db push  # 推到当前 linked project
```

⚠️ 实际执行迁移由用户在 Supabase Dashboard SQL Editor 手动跑（项目惯例）。本 task 仅准备 SQL 文件。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/023_add_video_jobs.sql supabase/migrations/024_add_notes_video_fields.sql
git commit -m "feat(db): video_jobs 表 + notes 视频字段扩展"
```

---

### Task 2：AI 分析层类型定义

**Files:**
- Create: `lib/ai-analysis/types.ts`

- [ ] **Step 1: 写 types.ts**

```typescript
/**
 * AI 分析层 · 类型定义
 *
 * 设计要点：
 * - AudioAnalysisProvider：音频/文本分析（首发 Tingwu，未来可换）
 * - VisualAnalysisProvider：视觉分析（Qwen-VL）
 * - 两个 Provider 独立，分别工厂创建
 *
 * 参考：docs/superpowers/specs/2026-05-12-video-and-storage-design.md §5
 */

export type AudioCapability =
  | 'transcript'
  | 'chapters'
  | 'summary'
  | 'key_points'
  | 'qa';

export interface TranscriptSegment {
  start: number;        // 秒
  end: number;          // 秒
  text: string;
  speaker?: string;     // 说话人 ID
}

export interface Chapter {
  start: number;
  end: number;
  title: string;
  summary?: string;
}

export interface QAPair {
  q: string;
  a: string;
  anchorTime?: number;  // 关联的视频时间点（秒），可选
}

export interface AudioAnalysisResult {
  transcript: TranscriptSegment[];
  chapters: Chapter[];
  summary: string;
  keyPoints: string[];
  qaPairs: QAPair[];
  speakers?: Array<{ id: string; label: string }>;
}

export interface AudioSubmitInput {
  mediaUrl: string;
  capabilities: AudioCapability[];
  language?: 'zh' | 'en' | 'auto';
}

export interface AudioPollResult {
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress?: number;
  result?: AudioAnalysisResult;
  error?: { code: string; message: string };
}

export interface AudioAnalysisProvider {
  readonly name: 'tingwu';
  submit(input: AudioSubmitInput): Promise<{ taskId: string }>;
  poll(taskId: string): Promise<AudioPollResult>;
}

export interface VisualFrameAnalysis {
  timestamp: number;
  sceneDescription: string;
  entities: string[];
  onScreenText?: string;
}

export interface VisualAnalysisProvider {
  readonly name: 'qwen-vl';
  analyzeFrames(input: {
    frames: Array<{ timestamp: number; url: string }>;
    context?: string;
  }): Promise<VisualFrameAnalysis[]>;
}
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected：lib/ai-analysis 下零 error

- [ ] **Step 3: Commit**

```bash
git add lib/ai-analysis/types.ts
git commit -m "feat(ai-analysis): 定义 Audio/Visual Provider 接口与类型"
```

---

### Task 3：Tingwu Adapter（TDD）

**Files:**
- Create: `lib/ai-analysis/adapters/tingwu.ts`
- Test: `tests/lib/ai-analysis/adapters/tingwu.test.ts`

⚠️ **开发前先做 Open Question Q1 的 spike**：用 curl 或简短 Node 脚本调用通义听悟 OpenAPI，验证：
1. submit 任务的最小必要参数集（appkey、access key 签名方式）
2. 各 capability 在返回 JSON 里的字段名
3. "智能问答 Q&A"能力是否真在 OpenAPI 暴露

如果 Q&A 不可用，submit 时不传该 capability，poll 时 qaPairs 返回空数组。**这不阻塞本 task 实现，只是影响测试 mock 数据的真实程度**。

实际调用要装阿里云 OpenAPI SDK：

```bash
npm install @alicloud/openapi-client @alicloud/tea-util @alicloud/credentials
```

听悟 API doc: https://help.aliyun.com/zh/tingwu/api-and-sdks

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/ai-analysis/adapters/tingwu.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock OpenAPI Client 创建出来的 client.request 方法
const requestMock = vi.fn();

vi.mock('@alicloud/openapi-client', () => ({
  default: { Config: class { constructor(_: any) {} } },
  Config: class { constructor(_: any) {} },
}));

vi.mock('@/lib/ai-analysis/adapters/tingwu-client', () => ({
  callTingwu: requestMock,
}));

import { TingwuAdapter } from '@/lib/ai-analysis/adapters/tingwu';

describe('TingwuAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALI_TINGWU_APPKEY = 'app';
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = 'id';
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = 'secret';
    process.env.ALIBABA_CLOUD_REGION = 'cn-beijing';
  });

  it('submit creates task and returns taskId', async () => {
    requestMock.mockResolvedValueOnce({
      body: { Data: { TaskId: 'tw-task-123' } },
    });
    const a = new TingwuAdapter();
    const result = await a.submit({
      mediaUrl: 'https://cos.example.com/v.mp4',
      capabilities: ['transcript', 'chapters', 'summary', 'key_points'],
    });
    expect(result.taskId).toBe('tw-task-123');
  });

  it('submit throws on API error', async () => {
    requestMock.mockRejectedValueOnce(new Error('appkey invalid'));
    const a = new TingwuAdapter();
    await expect(a.submit({ mediaUrl: 'x', capabilities: ['transcript'] }))
      .rejects.toThrow(/appkey invalid/);
  });

  it('poll maps done response to AudioAnalysisResult', async () => {
    requestMock.mockResolvedValueOnce({
      body: {
        Data: {
          TaskStatus: 'COMPLETED',
          Result: {
            Transcription: {
              Paragraphs: [{
                Sentences: [
                  { BeginTime: 0, EndTime: 2000, Text: '你好', SpeakerId: 'A' },
                  { BeginTime: 2000, EndTime: 4500, Text: '欢迎', SpeakerId: 'B' },
                ],
              }],
            },
            AutoChapters: [
              { Start: 0, End: 60000, Headline: '开场', Summary: '主持人开场' },
            ],
            Summarization: { ParagraphSummary: '这是个新闻视频。' },
            KeyPoints: ['观点A', '观点B'],
          },
        },
      },
    });
    const a = new TingwuAdapter();
    const r = await a.poll('tw-task-123');
    expect(r.status).toBe('done');
    expect(r.result?.transcript).toHaveLength(2);
    expect(r.result?.transcript[0]).toEqual(
      expect.objectContaining({ start: 0, end: 2, text: '你好', speaker: 'A' })
    );
    expect(r.result?.chapters[0].title).toBe('开场');
    expect(r.result?.chapters[0].start).toBe(0);
    expect(r.result?.chapters[0].end).toBe(60);
    expect(r.result?.summary).toBe('这是个新闻视频。');
    expect(r.result?.keyPoints).toEqual(['观点A', '观点B']);
  });

  it('poll returns processing when task is in progress', async () => {
    requestMock.mockResolvedValueOnce({
      body: { Data: { TaskStatus: 'ONGOING' } },
    });
    const a = new TingwuAdapter();
    const r = await a.poll('tw-task-123');
    expect(r.status).toBe('processing');
    expect(r.result).toBeUndefined();
  });

  it('poll returns failed with error details', async () => {
    requestMock.mockResolvedValueOnce({
      body: { Data: { TaskStatus: 'FAILED', ErrorCode: 'AUDIO_TOO_LONG', ErrorMessage: '超过 5 小时' } },
    });
    const a = new TingwuAdapter();
    const r = await a.poll('tw-task-123');
    expect(r.status).toBe('failed');
    expect(r.error?.code).toBe('AUDIO_TOO_LONG');
  });

  it('throws when env missing', () => {
    delete process.env.ALI_TINGWU_APPKEY;
    expect(() => new TingwuAdapter()).toThrow(/ALI_TINGWU_APPKEY/);
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npm test -- tests/lib/ai-analysis/adapters/tingwu.test.ts
```

Expected：FAIL with "Cannot find module"

- [ ] **Step 3: 实现 `lib/ai-analysis/adapters/tingwu-client.ts`（薄客户端封装层）**

```typescript
// lib/ai-analysis/adapters/tingwu-client.ts
/**
 * Tingwu API HTTP client thin wrapper.
 *
 * 这里用 ROA 风格的 OpenAPI 调用：
 * - 主入口 https://tingwu.cn-beijing.aliyuncs.com/openapi/tingwu/v2/tasks/{action}
 * - signature 由 @alicloud/openapi-client 自动处理
 *
 * 隔离原因：方便测试时 mock 整个 callTingwu，不用 mock OpenAPI SDK 细节。
 */
import Credential from '@alicloud/credentials';
// 注意：实际 SDK 用法以阿里云官方文档为准，这里给最小可行版本
// 如果文档要求别的 client class，构造方式按文档调整

export async function callTingwu(action: string, body: Record<string, unknown>): Promise<any> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const region = process.env.ALIBABA_CLOUD_REGION || 'cn-beijing';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Aliyun credentials missing');
  }

  // 简化的 HTTP 调用（生产应使用阿里云 SDK 的 RPCClient/ROAClient）
  const url = `https://tingwu.${region}.aliyuncs.com/openapi/tingwu/v2/tasks/${action}`;
  // 签名细节：实际接入时使用 @alicloud/openapi-client 的 Client.callApi()
  // 此处仅占位；TingwuAdapter 测试 mock 了 callTingwu 整体，故无需 mock 签名

  // TODO(spike): 用 @alicloud/openapi-client 构造 Client，调 client.callApi()
  throw new Error('callTingwu HTTP body not implemented; use @alicloud/openapi-client Client.callApi at integration time');
}
```

**Note**：阿里云 OpenAPI 的签名复杂度高（HMAC-SHA1 + 规范化 query），不应自己实现。整合阶段一定要用 `@alicloud/openapi-client` 的 `Client.callApi()`。本 plan 的 task 重点是接口形状 + 单测覆盖，HTTP 签名是 spike 阶段验证的，**留 TODO 在该函数里**。

- [ ] **Step 4: 实现 `lib/ai-analysis/adapters/tingwu.ts`**

```typescript
// lib/ai-analysis/adapters/tingwu.ts
import type {
  AudioAnalysisProvider,
  AudioSubmitInput,
  AudioPollResult,
  AudioAnalysisResult,
  TranscriptSegment,
  Chapter,
} from '../types';
import { callTingwu } from './tingwu-client';

const REQUIRED_ENV = [
  'ALI_TINGWU_APPKEY',
  'ALIBABA_CLOUD_ACCESS_KEY_ID',
  'ALIBABA_CLOUD_ACCESS_KEY_SECRET',
];

export class TingwuAdapter implements AudioAnalysisProvider {
  readonly name = 'tingwu' as const;

  constructor() {
    for (const k of REQUIRED_ENV) {
      if (!process.env[k]) throw new Error(`${k} is required for TingwuAdapter`);
    }
  }

  async submit(input: AudioSubmitInput): Promise<{ taskId: string }> {
    const body = {
      AppKey: process.env.ALI_TINGWU_APPKEY,
      Input: {
        SourceLanguage: input.language ?? 'cn',
        FileUrl: input.mediaUrl,
        Format: undefined,  // 自动识别
      },
      Parameters: buildCapabilityParameters(input.capabilities),
    };
    const data = await callTingwu('put', body);
    const taskId = data?.body?.Data?.TaskId;
    if (!taskId) throw new Error(`tingwu submit: no TaskId in response: ${JSON.stringify(data)}`);
    return { taskId };
  }

  async poll(taskId: string): Promise<AudioPollResult> {
    const data = await callTingwu(`${taskId}`, {});  // GET task
    const d = data?.body?.Data;
    const status = d?.TaskStatus;

    if (status === 'COMPLETED') {
      return { status: 'done', result: mapResult(d.Result) };
    }
    if (status === 'FAILED') {
      return {
        status: 'failed',
        error: { code: d?.ErrorCode ?? 'UNKNOWN', message: d?.ErrorMessage ?? '' },
      };
    }
    if (status === 'ONGOING' || status === 'QUEUEING') {
      return { status: 'processing' };
    }
    return { status: 'pending' };
  }
}

function buildCapabilityParameters(caps: Array<string>): Record<string, any> {
  return {
    Transcription: { DiarizationEnabled: caps.includes('transcript') },
    AutoChaptersEnabled: caps.includes('chapters'),
    SummarizationEnabled: caps.includes('summary'),
    KeyPointsEnabled: caps.includes('key_points'),
    // 注：Q&A 是否真的能开取决于 spike 验证；不可用时不传
    AskQuestionEnabled: caps.includes('qa'),
  };
}

function mapResult(raw: any): AudioAnalysisResult {
  const transcript: TranscriptSegment[] = [];
  for (const p of raw?.Transcription?.Paragraphs ?? []) {
    for (const s of p.Sentences ?? []) {
      transcript.push({
        start: Number(s.BeginTime ?? 0) / 1000,
        end: Number(s.EndTime ?? 0) / 1000,
        text: String(s.Text ?? ''),
        speaker: s.SpeakerId ? String(s.SpeakerId) : undefined,
      });
    }
  }

  const chapters: Chapter[] = (raw?.AutoChapters ?? []).map((c: any) => ({
    start: Number(c.Start ?? 0) / 1000,
    end: Number(c.End ?? 0) / 1000,
    title: String(c.Headline ?? ''),
    summary: c.Summary ? String(c.Summary) : undefined,
  }));

  return {
    transcript,
    chapters,
    summary: String(raw?.Summarization?.ParagraphSummary ?? ''),
    keyPoints: (raw?.KeyPoints ?? []).map((kp: any) => String(kp)),
    qaPairs: (raw?.MeetingAssistance?.QAs ?? []).map((q: any) => ({
      q: String(q.Q ?? ''),
      a: String(q.A ?? ''),
    })),
    speakers: raw?.Transcription?.Speakers
      ? raw.Transcription.Speakers.map((sp: any) => ({
          id: String(sp.Id),
          label: String(sp.Label ?? sp.Id),
        }))
      : undefined,
  };
}
```

- [ ] **Step 5: 跑测试确认通过**

```bash
npm test -- tests/lib/ai-analysis/adapters/tingwu.test.ts
```

Expected：6 个测试全过

- [ ] **Step 6: Commit**

```bash
git add lib/ai-analysis/adapters/tingwu.ts lib/ai-analysis/adapters/tingwu-client.ts tests/lib/ai-analysis/adapters/tingwu.test.ts
git commit -m "feat(ai-analysis): 实现阿里通义听悟 adapter（TDD，含响应映射）"
```

---

### Task 4：Qwen-VL Adapter（TDD）

**Files:**
- Create: `lib/ai-analysis/adapters/qwen-vl.ts`
- Test: `tests/lib/ai-analysis/adapters/qwen-vl.test.ts`

DashScope 文档：https://help.aliyun.com/zh/dashscope/developer-reference/api-details

调用 `qwen-vl-max` 模型，可以传图片 URL（不需要下载到本地）。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/ai-analysis/adapters/qwen-vl.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { QwenVlAdapter } from '@/lib/ai-analysis/adapters/qwen-vl';

describe('QwenVlAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    process.env.DASHSCOPE_VISION_MODEL = 'qwen-vl-max';
  });

  it('analyzeFrames returns per-frame analysis', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: {
          choices: [{
            message: {
              content: JSON.stringify([
                {
                  timestamp: 0,
                  sceneDescription: '一个新闻演播室',
                  entities: ['主持人', '电视台 logo'],
                  onScreenText: '今日要闻',
                },
                {
                  timestamp: 30,
                  sceneDescription: '街头采访',
                  entities: ['路人', '城市街景'],
                },
              ]),
            },
          }],
        },
      }),
    });
    const a = new QwenVlAdapter();
    const r = await a.analyzeFrames({
      frames: [
        { timestamp: 0, url: 'https://cos.example.com/f-000000.jpg' },
        { timestamp: 30, url: 'https://cos.example.com/f-000030.jpg' },
      ],
      context: '新闻视频',
    });
    expect(r).toHaveLength(2);
    expect(r[0].sceneDescription).toBe('一个新闻演播室');
    expect(r[0].entities).toContain('主持人');
    expect(r[1].timestamp).toBe(30);
  });

  it('returns empty array when frames empty', async () => {
    const a = new QwenVlAdapter();
    const r = await a.analyzeFrames({ frames: [] });
    expect(r).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on DashScope API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'invalid api key' }),
    });
    const a = new QwenVlAdapter();
    await expect(a.analyzeFrames({
      frames: [{ timestamp: 0, url: 'x' }],
    })).rejects.toThrow(/invalid api key/);
  });

  it('throws when DASHSCOPE_API_KEY missing', () => {
    delete process.env.DASHSCOPE_API_KEY;
    expect(() => new QwenVlAdapter()).toThrow(/DASHSCOPE_API_KEY/);
  });

  it('handles non-JSON LLM response gracefully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: {
          choices: [{
            message: { content: 'this is not json' },
          }],
        },
      }),
    });
    const a = new QwenVlAdapter();
    const r = await a.analyzeFrames({ frames: [{ timestamp: 0, url: 'x' }] });
    // 回退为单帧通用描述，避免抛错（视觉失败不阻塞 fully_ready 决策）
    expect(r).toHaveLength(1);
    expect(r[0].sceneDescription).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npm test -- tests/lib/ai-analysis/adapters/qwen-vl.test.ts
```

- [ ] **Step 3: 实现 qwen-vl.ts**

```typescript
// lib/ai-analysis/adapters/qwen-vl.ts
import type {
  VisualAnalysisProvider,
  VisualFrameAnalysis,
} from '../types';

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

export class QwenVlAdapter implements VisualAnalysisProvider {
  readonly name = 'qwen-vl' as const;
  private apiKey: string;
  private model: string;

  constructor() {
    const key = process.env.DASHSCOPE_API_KEY;
    if (!key) throw new Error('DASHSCOPE_API_KEY is required for QwenVlAdapter');
    this.apiKey = key;
    this.model = process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-max';
  }

  async analyzeFrames(input: {
    frames: Array<{ timestamp: number; url: string }>;
    context?: string;
  }): Promise<VisualFrameAnalysis[]> {
    if (!input.frames.length) return [];

    const prompt = buildPrompt(input.frames, input.context);
    const body = {
      model: this.model,
      input: {
        messages: [{
          role: 'user',
          content: [
            { text: prompt },
            ...input.frames.map((f) => ({ image: f.url })),
          ],
        }],
      },
      parameters: { result_format: 'message' },
    };

    const res = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Qwen-VL API ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const content = data?.output?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Qwen-VL: empty response');

    return parseFrameAnalysis(content, input.frames);
  }
}

function buildPrompt(frames: Array<{ timestamp: number; url: string }>, context?: string): string {
  const tsList = frames.map((f, i) => `(${i+1}) ${f.timestamp}s`).join('、');
  return [
    context ? `视频背景：${context}` : '',
    `下面给你 ${frames.length} 张关键帧图，时间点分别为：${tsList}。`,
    '请对每帧返回：sceneDescription（一句话场景描述）、entities（出场人物/物体数组）、onScreenText（屏幕上的文字，如有）。',
    '返回 JSON 数组，每个元素含 timestamp/sceneDescription/entities/onScreenText 字段。',
    '只返回 JSON，不要说别的。',
  ].filter(Boolean).join('\n');
}

function parseFrameAnalysis(
  content: string,
  frames: Array<{ timestamp: number; url: string }>
): VisualFrameAnalysis[] {
  // 1. 尝试直接 JSON.parse
  // 2. 失败的话从内容中抓 JSON 数组片段
  // 3. 还失败 → 回退为单帧通用描述（避免阻塞主流程）
  let parsed: any = null;
  try { parsed = JSON.parse(content); } catch {}
  if (!Array.isArray(parsed)) {
    const m = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch {}
    }
  }
  if (!Array.isArray(parsed)) {
    return frames.map((f) => ({
      timestamp: f.timestamp,
      sceneDescription: '画面理解暂不可用',
      entities: [],
    }));
  }
  return parsed.map((p: any, i: number) => ({
    timestamp: Number(p.timestamp ?? frames[i]?.timestamp ?? 0),
    sceneDescription: String(p.sceneDescription ?? ''),
    entities: Array.isArray(p.entities) ? p.entities.map(String) : [],
    onScreenText: p.onScreenText ? String(p.onScreenText) : undefined,
  }));
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/ai-analysis/adapters/qwen-vl.test.ts
```

Expected：5 个测试全过

- [ ] **Step 5: Commit**

```bash
git add lib/ai-analysis/adapters/qwen-vl.ts tests/lib/ai-analysis/adapters/qwen-vl.test.ts
git commit -m "feat(ai-analysis): 实现 Qwen-VL 视觉分析 adapter（含 JSON 回退）"
```

---

### Task 5：AI Provider 工厂 + barrel

**Files:**
- Create: `lib/ai-analysis/audio-provider.ts`
- Create: `lib/ai-analysis/visual-provider.ts`
- Create: `lib/ai-analysis/index.ts`

- [ ] **Step 1: audio-provider.ts**

```typescript
// lib/ai-analysis/audio-provider.ts
import type { AudioAnalysisProvider } from './types';
import { TingwuAdapter } from './adapters/tingwu';

let cached: AudioAnalysisProvider | null = null;

export function getAudioAnalysisProvider(): AudioAnalysisProvider {
  if (cached) return cached;
  const p = process.env.AUDIO_ANALYSIS_PROVIDER ?? 'tingwu';
  if (p !== 'tingwu') {
    throw new Error(`unknown AUDIO_ANALYSIS_PROVIDER: ${p}`);
  }
  cached = new TingwuAdapter();
  return cached;
}

export function _resetAudioProviderCache() { cached = null; }
```

- [ ] **Step 2: visual-provider.ts**

```typescript
// lib/ai-analysis/visual-provider.ts
import type { VisualAnalysisProvider } from './types';
import { QwenVlAdapter } from './adapters/qwen-vl';

let cached: VisualAnalysisProvider | null = null;

export function getVisualAnalysisProvider(): VisualAnalysisProvider | null {
  if (cached) return cached;
  const p = process.env.VISUAL_ANALYSIS_PROVIDER ?? 'qwen-vl';
  if (p === 'none') return null;
  if (p !== 'qwen-vl') {
    throw new Error(`unknown VISUAL_ANALYSIS_PROVIDER: ${p}`);
  }
  cached = new QwenVlAdapter();
  return cached;
}

export function _resetVisualProviderCache() { cached = null; }
```

- [ ] **Step 3: index.ts barrel**

```typescript
// lib/ai-analysis/index.ts
export * from './types';
export { getAudioAnalysisProvider } from './audio-provider';
export { getVisualAnalysisProvider } from './visual-provider';
```

- [ ] **Step 4: typecheck + 跑 ai-analysis 套件**

```bash
npx tsc --noEmit && npm test -- tests/lib/ai-analysis
```

Expected：零 error，11+ tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai-analysis/audio-provider.ts lib/ai-analysis/visual-provider.ts lib/ai-analysis/index.ts
git commit -m "feat(ai-analysis): provider 工厂 + barrel"
```

---

### Task 6：交互式 Q&A 服务（TDD）

**Files:**
- Create: `lib/ai-analysis/qa-service.ts`
- Test: `tests/lib/ai-analysis/qa-service.test.ts`

Q&A 基于 `audio_result.transcript` 走通义千问 chat completion。复用 DashScope 的文本模型（`qwen-plus`）。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/ai-analysis/qa-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { askVideoQuestion } from '@/lib/ai-analysis/qa-service';
import type { TranscriptSegment } from '@/lib/ai-analysis/types';

describe('askVideoQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'sk-test';
    process.env.DASHSCOPE_TEXT_MODEL = 'qwen-plus';
  });

  it('returns answer from LLM', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: { choices: [{ message: { content: '主持人 A 说欢迎' } }] },
      }),
    });
    const transcript: TranscriptSegment[] = [
      { start: 0, end: 2, text: '欢迎收看', speaker: 'A' },
    ];
    const r = await askVideoQuestion({ transcript, question: '主持人说了什么' });
    expect(r.answer).toBe('主持人 A 说欢迎');
  });

  it('truncates very long transcript via summary pass', async () => {
    // 30k tokens transcript（粗略 9 万字符）；service 会先抽 Qwen 摘要再问
    fetchMock
      .mockResolvedValueOnce({   // 第一次：摘要
        ok: true,
        json: async () => ({ output: { choices: [{ message: { content: '【段落摘要】' } }] } }),
      })
      .mockResolvedValueOnce({   // 第二次：真正回答
        ok: true,
        json: async () => ({ output: { choices: [{ message: { content: '答案' } }] } }),
      });
    const huge = Array.from({ length: 1000 }, (_, i) => ({
      start: i, end: i + 1, text: '一'.repeat(100), speaker: 'A',
    }));
    const r = await askVideoQuestion({ transcript: huge, question: '主题是什么' });
    expect(r.answer).toBe('答案');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => 'server error',
    });
    await expect(askVideoQuestion({
      transcript: [{ start: 0, end: 1, text: 'x' }],
      question: 'y',
    })).rejects.toThrow(/server error|500/);
  });

  it('includes history in prompt when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: { choices: [{ message: { content: '继续回答' } }] } }),
    });
    await askVideoQuestion({
      transcript: [{ start: 0, end: 1, text: '欢迎' }],
      question: '继续',
      history: [
        { role: 'user', content: '主题是什么' },
        { role: 'assistant', content: '欢迎' },
      ],
    });
    const callBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    const messages = callBody.input.messages;
    expect(messages.length).toBeGreaterThanOrEqual(3); // system + history + user
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npm test -- tests/lib/ai-analysis/qa-service.test.ts
```

- [ ] **Step 3: 实现 qa-service.ts**

```typescript
// lib/ai-analysis/qa-service.ts
import type { TranscriptSegment } from './types';

const ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const TRANSCRIPT_TOKEN_BUDGET = 25000; // ~75000 chars

export interface AskInput {
  transcript: TranscriptSegment[];
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function askVideoQuestion(input: AskInput): Promise<{ answer: string }> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY required');

  const transcriptText = serializeTranscript(input.transcript);
  const transcriptForPrompt = transcriptText.length > TRANSCRIPT_TOKEN_BUDGET * 3
    ? await summarizeTranscript(apiKey, transcriptText)
    : transcriptText;

  const messages: any[] = [
    {
      role: 'system',
      content:
        '你是基于视频转写文本回答问题的助手。回答简洁、忠实于内容；若提及说话人请用 SpeakerId。',
    },
    { role: 'user', content: `【视频转写】\n${transcriptForPrompt}\n【提问】${input.question}` },
  ];
  if (input.history) {
    // 把 history 插在 user 提问前
    messages.splice(1, 0, ...input.history);
  }

  const res = await callQwen(apiKey, messages);
  return { answer: res };
}

function serializeTranscript(transcript: TranscriptSegment[]): string {
  return transcript.map(s =>
    `[${formatTime(s.start)}-${formatTime(s.end)}]${s.speaker ? ` ${s.speaker}:` : ''} ${s.text}`
  ).join('\n');
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function summarizeTranscript(apiKey: string, transcriptText: string): Promise<string> {
  // 分段摘要：每 N 字一段，每段让模型抽 1 段要点
  const messages = [
    { role: 'system', content: '你压缩长文本：保留要点 + 重要人名/时间/术语。' },
    { role: 'user', content: `请把以下视频转写压缩成 5000 字以内的段落摘要：\n${transcriptText.slice(0, 60000)}` },
  ];
  return await callQwen(apiKey, messages);
}

async function callQwen(apiKey: string, messages: any[]): Promise<string> {
  const model = process.env.DASHSCOPE_TEXT_MODEL || 'qwen-plus';
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { messages },
      parameters: { result_format: 'message' },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Qwen API ${res.status}: ${t}`);
  }
  const data = await res.json();
  const answer = data?.output?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string') throw new Error('Qwen: empty answer');
  return answer;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/ai-analysis/qa-service.test.ts
```

Expected：4 个测试全过

- [ ] **Step 5: Commit**

```bash
git add lib/ai-analysis/qa-service.ts tests/lib/ai-analysis/qa-service.test.ts
git commit -m "feat(ai-analysis): 交互式视频 Q&A 服务（长 transcript 自动摘要）"
```

---

### Task 7：Worker 类型 + DB 访问封装（TDD）

**Files:**
- Create: `lib/workers/video-pipeline/types.ts`
- Create: `lib/workers/video-pipeline/db.ts`
- Test: `tests/lib/workers/video-pipeline/db.test.ts`

- [ ] **Step 1: types.ts**

```typescript
// lib/workers/video-pipeline/types.ts
export type VideoJobStepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
export type DownloadStatus = VideoJobStepStatus | 'need_browser_fallback';
export type DownloadStrategy = 'server' | 'browser';
export type OverallStatus =
  | 'processing'
  | 'media_ready'
  | 'fully_ready'
  | 'failed'
  | 'need_browser_fallback';

export interface VideoJob {
  id: string;
  note_id: string;
  user_id: string;
  source_url: string;
  platform: string;
  source_video_url: string;
  request_headers: Record<string, string> | null;
  download_strategy: DownloadStrategy;

  download_status: DownloadStatus;
  cos_key: string | null;
  cos_url: string | null;
  size_bytes: number | null;
  download_error: string | null;

  probe_status: VideoJobStepStatus;
  probe_data: any;

  cover_status: VideoJobStepStatus;
  cover_url: string | null;

  frame_status: VideoJobStepStatus;
  frames: any;

  audio_status: VideoJobStepStatus;
  audio_task_id: string | null;
  audio_result: any;
  audio_error: string | null;

  visual_status: VideoJobStepStatus;
  visual_result: any;
  visual_error: string | null;

  retry_count: number;
  next_retry_at: string | null;
  updated_at: string;
}

export type StepName =
  | 'download' | 'probe' | 'cover' | 'frame'
  | 'audio' | 'visual';
```

- [ ] **Step 2: 写 db.test.ts**

```typescript
// tests/lib/workers/video-pipeline/db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const limitMock = vi.fn();
const orderMock = vi.fn();
const inMock = vi.fn();
const orMock = vi.fn();

vi.mock('@/lib/supabase/server-service', () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

import { fetchPendingJobs, markStep, isStale } from '@/lib/workers/video-pipeline/db';

describe('isStale', () => {
  it('returns true when updated_at older than threshold', () => {
    const old = new Date(Date.now() - 31 * 60_000).toISOString();
    expect(isStale(old, 30 * 60_000)).toBe(true);
  });
  it('returns false when updated_at recent', () => {
    const recent = new Date().toISOString();
    expect(isStale(recent, 30 * 60_000)).toBe(false);
  });
});

describe('markStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      update: updateMock.mockReturnValue({
        eq: eqMock.mockResolvedValue({ error: null }),
      }),
    });
  });
  it('updates download status to in_progress', async () => {
    await markStep('job-1', 'download', 'in_progress');
    expect(updateMock).toHaveBeenCalledWith({ download_status: 'in_progress' });
    expect(eqMock).toHaveBeenCalledWith('id', 'job-1');
  });
  it('updates with extra fields', async () => {
    await markStep('job-1', 'audio', 'done', { audio_task_id: 'tw-x' });
    expect(updateMock).toHaveBeenCalledWith({ audio_status: 'done', audio_task_id: 'tw-x' });
  });
});

describe('fetchPendingJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({
      select: selectMock.mockReturnValue({
        or: orMock.mockReturnValue({
          order: orderMock.mockReturnValue({
            limit: limitMock.mockResolvedValue({ data: [{ id: 'j1' }, { id: 'j2' }], error: null }),
          }),
        }),
      }),
    });
  });
  it('returns up to 10 jobs needing work', async () => {
    const r = await fetchPendingJobs(10);
    expect(r).toHaveLength(2);
    expect(orMock).toHaveBeenCalled();
    expect(limitMock).toHaveBeenCalledWith(10);
  });
});
```

- [ ] **Step 3: 跑测试确认 FAIL**

```bash
npm test -- tests/lib/workers/video-pipeline/db.test.ts
```

- [ ] **Step 4: 创建 `lib/supabase/server-service.ts`（service role client）**

```typescript
// lib/supabase/server-service.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Service role client（绕 RLS），用于后台 worker 操作。
 * ⚠️ 仅限服务器端使用，绝不暴露到客户端。
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for worker DB access');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 5: 实现 db.ts**

```typescript
// lib/workers/video-pipeline/db.ts
import { createServiceClient } from '@/lib/supabase/server-service';
import type { VideoJob, VideoJobStepStatus, StepName } from './types';

const STEP_STATUS_COLUMN: Record<StepName, string> = {
  download: 'download_status',
  probe: 'probe_status',
  cover: 'cover_status',
  frame: 'frame_status',
  audio: 'audio_status',
  visual: 'visual_status',
};

export async function fetchPendingJobs(limit: number = 10): Promise<VideoJob[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_jobs')
    .select('*')
    .or([
      `download_status.in.(pending,in_progress)`,
      `probe_status.in.(pending,in_progress)`,
      `cover_status.in.(pending,in_progress)`,
      `frame_status.in.(pending,in_progress)`,
      `audio_status.in.(pending,in_progress)`,
      `visual_status.in.(pending,in_progress)`,
    ].join(','))
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`fetchPendingJobs: ${error.message}`);
  return (data ?? []) as VideoJob[];
}

export async function markStep(
  jobId: string,
  step: StepName,
  status: VideoJobStepStatus | string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const column = STEP_STATUS_COLUMN[step];
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('video_jobs')
    .update({ [column]: status, ...extra })
    .eq('id', jobId);
  if (error) throw new Error(`markStep ${step}=${status}: ${error.message}`);
}

export async function incrementRetry(jobId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('video_jobs').select('retry_count').eq('id', jobId).single();
  const next = (data?.retry_count ?? 0) + 1;
  const delayMs = Math.pow(2, next) * 60_000;
  await supabase.from('video_jobs').update({
    retry_count: next,
    next_retry_at: new Date(Date.now() + delayMs).toISOString(),
  }).eq('id', jobId);
}

export function isStale(updatedAt: string, thresholdMs: number): boolean {
  return Date.now() - new Date(updatedAt).getTime() > thresholdMs;
}
```

- [ ] **Step 6: 跑测试确认通过**

```bash
npm test -- tests/lib/workers/video-pipeline/db.test.ts
```

Expected：4+ tests PASS

- [ ] **Step 7: Commit**

```bash
git add lib/workers/video-pipeline/types.ts lib/workers/video-pipeline/db.ts lib/supabase/server-service.ts tests/lib/workers/video-pipeline/db.test.ts
git commit -m "feat(worker): video-pipeline types + DB 访问封装"
```

---

### Task 8：step-download（TDD）

**Files:**
- Create: `lib/workers/video-pipeline/step-download.ts`
- Test: `tests/lib/workers/video-pipeline/step-download.test.ts`

A 路径：服务端从 source_video_url 拉视频字节，传 COS。B 路径在 step-download 里直接跳过（B 路径下载由插件做，完成后 status 已是 'done'）。

- [ ] **Step 1: 写测试**

```typescript
// tests/lib/workers/video-pipeline/step-download.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const markStepMock = vi.fn();
const incrementRetryMock = vi.fn();
const uploadMock = vi.fn();
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/workers/video-pipeline/db', () => ({
  markStep: markStepMock,
  incrementRetry: incrementRetryMock,
  isStale: () => false,
}));
vi.mock('@/lib/storage', () => ({
  getStorageProvider: () => ({
    upload: uploadMock,
    getPublicUrl: (k: string) => `https://cos.example.com/${k}`,
  }),
  buildStorageKey: (input: any) => `${input.userId}/${input.kind}/2026/05/12/abc.${input.ext}`,
}));

import { runDownloadStep } from '@/lib/workers/video-pipeline/step-download';

const baseJob = {
  id: 'j1',
  user_id: 'u1',
  source_video_url: 'https://platform.com/v.mp4',
  request_headers: { Referer: 'https://platform.com' },
  download_strategy: 'server' as const,
  download_status: 'pending' as const,
  updated_at: new Date().toISOString(),
};

describe('runDownloadStep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('downloads and uploads to COS, marks done', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    });
    uploadMock.mockResolvedValueOnce({
      url: 'https://cos.example.com/u1/videos/2026/05/12/abc.mp4',
      key: 'u1/videos/2026/05/12/abc.mp4',
      size: 1024,
    });
    await runDownloadStep(baseJob as any);
    expect(markStepMock).toHaveBeenCalledWith('j1', 'download', 'in_progress');
    expect(uploadMock).toHaveBeenCalledWith(expect.objectContaining({
      contentType: expect.any(String),
    }));
    expect(markStepMock).toHaveBeenLastCalledWith('j1', 'download', 'done', expect.objectContaining({
      cos_key: 'u1/videos/2026/05/12/abc.mp4',
      cos_url: expect.stringContaining('cos.example.com'),
      size_bytes: 1024,
    }));
  });

  it('skips when download_status is done', async () => {
    await runDownloadStep({ ...baseJob, download_status: 'done' } as any);
    expect(markStepMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips when strategy is browser (插件代下载)', async () => {
    await runDownloadStep({ ...baseJob, download_strategy: 'browser' } as any);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks need_browser_fallback on 403 (anti-hotlink)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
    await runDownloadStep(baseJob as any);
    expect(markStepMock).toHaveBeenLastCalledWith('j1', 'download', 'need_browser_fallback', expect.any(Object));
  });

  it('marks failed and increments retry on 5xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' });
    await runDownloadStep(baseJob as any);
    expect(markStepMock).toHaveBeenLastCalledWith('j1', 'download', 'failed', expect.objectContaining({
      download_error: expect.stringContaining('502'),
    }));
    expect(incrementRetryMock).toHaveBeenCalledWith('j1');
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npm test -- tests/lib/workers/video-pipeline/step-download.test.ts
```

- [ ] **Step 3: 实现 step-download.ts**

```typescript
// lib/workers/video-pipeline/step-download.ts
import { getStorageProvider, buildStorageKey } from '@/lib/storage';
import { markStep, incrementRetry, isStale } from './db';
import type { VideoJob } from './types';

const STALENESS_MS = 30 * 60_000;

export async function runDownloadStep(job: VideoJob): Promise<void> {
  if (job.download_status === 'done' || job.download_status === 'failed' || job.download_status === 'need_browser_fallback') {
    return;
  }
  if (job.download_strategy === 'browser') {
    // B 路径由插件做；如果还是 pending，等插件回报 video-upload-done
    return;
  }
  if (job.download_status === 'in_progress' && !isStale(job.updated_at, STALENESS_MS)) {
    return; // 别人在跑
  }

  await markStep(job.id, 'download', 'in_progress');

  try {
    const res = await fetch(job.source_video_url, {
      headers: job.request_headers ?? {},
    });
    if (res.status === 403) {
      // 反盗链或 IP 拦截
      await markStep(job.id, 'download', 'need_browser_fallback', {
        download_error: `HTTP 403 (likely anti-hotlink) — needs browser fallback`,
      });
      return;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'video/mp4';
    const ext = guessExt(contentType, job.source_video_url);
    const key = buildStorageKey({ userId: job.user_id, kind: 'videos', ext });

    const result = await getStorageProvider().upload({ key, body: buf, contentType });

    await markStep(job.id, 'download', 'done', {
      cos_key: result.key,
      cos_url: result.url,
      size_bytes: result.size,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markStep(job.id, 'download', 'failed', { download_error: msg });
    await incrementRetry(job.id);
  }
}

function guessExt(contentType: string, url: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('quicktime')) return 'mov';
  if (lower.includes('mpegurl')) return 'm3u8';
  // URL fallback
  const urlExt = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (urlExt && urlExt.length <= 5) return urlExt;
  return 'mp4';
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/workers/video-pipeline/step-download.test.ts
```

Expected：5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/workers/video-pipeline/step-download.ts tests/lib/workers/video-pipeline/step-download.test.ts
git commit -m "feat(worker): step-download（A 路径下载，B 路径跳过，403 降级）"
```

---

### Task 9：step-probe-and-cover（TDD）

**Files:**
- Create: `lib/workers/video-pipeline/step-probe-and-cover.ts`
- Test: `tests/lib/workers/video-pipeline/step-probe-and-cover.test.ts`

利用 Plan A 的 `MediaProcessingCapability`：probe 拿 duration/codec/分辨率，generateSmartCover 拿封面。

- [ ] **Step 1: 写测试**（mock storage provider 的 probe/generateSmartCover）

测试要点：
- job 的 download_status='done' 才推进
- probe 完成 → 写 probe_data + 更新 notes.media_duration（要 mock notes update）
- cover 完成 → 写 cover_url
- 错误时各 status 单独 failed（probe 失败不阻断 cover）

测试代码（约 60 行，参考 Task 8 风格）—— 略，自行展开类似结构。

- [ ] **Step 2-3: 实现**

实现要点：
```typescript
// lib/workers/video-pipeline/step-probe-and-cover.ts
import { getStorageProvider, hasMediaProcessing, buildStorageKey } from '@/lib/storage';
import { createServiceClient } from '@/lib/supabase/server-service';
import { markStep, isStale } from './db';
import type { VideoJob } from './types';

export async function runProbeAndCoverStep(job: VideoJob): Promise<void> {
  if (job.download_status !== 'done' || !job.cos_key) return;

  const provider = getStorageProvider();
  if (!hasMediaProcessing(provider)) {
    // Supabase 无 CI 能力，跳过
    await markStep(job.id, 'probe', 'skipped');
    await markStep(job.id, 'cover', 'skipped');
    return;
  }

  // probe
  if (job.probe_status === 'pending' || (job.probe_status === 'in_progress' && isStale(job.updated_at, 10 * 60_000))) {
    try {
      await markStep(job.id, 'probe', 'in_progress');
      const info = await provider.probe(job.cos_key);
      await markStep(job.id, 'probe', 'done', { probe_data: info });
      // 同步 notes.media_duration
      const supabase = createServiceClient();
      await supabase.from('notes').update({ media_duration: Math.round(info.durationSec) }).eq('id', job.note_id);
    } catch (err) {
      await markStep(job.id, 'probe', 'failed');
    }
  }

  // cover
  if (job.cover_status === 'pending' || (job.cover_status === 'in_progress' && isStale(job.updated_at, 10 * 60_000))) {
    try {
      await markStep(job.id, 'cover', 'in_progress');
      const outKey = buildStorageKey({ userId: job.user_id, kind: 'covers', ext: 'jpg' });
      const cover = await provider.generateSmartCover({ sourceKey: job.cos_key, outputKey: outKey });
      await markStep(job.id, 'cover', 'done', { cover_url: cover.url });
    } catch (err) {
      await markStep(job.id, 'cover', 'failed');
    }
  }
}
```

- [ ] **Step 4: 跑测试 PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(worker): step-probe-and-cover（COS CI 元信息探测 + 智能封面）"
```

---

### Task 10：step-extract-frames + step-analyze-visual（TDD）

**Files:**
- Create: `lib/workers/video-pipeline/step-extract-frames.ts`
- Create: `lib/workers/video-pipeline/step-analyze-visual.ts`
- Test: 各 1 个 test file

Frame extraction 按章节切：从 `audio_result.chapters` 取每章中点作为抽帧时间戳；如 chapters 不可用，按 60 秒间隔抽。

Visual analysis 拿 frames + 简单 context（标题）调 Qwen-VL。

- [ ] **Step 1-5: 按 Task 8/9 模板做 TDD**

实现要点（extract-frames）：
```typescript
export async function runExtractFramesStep(job: VideoJob): Promise<void> {
  if (job.frame_status !== 'pending') return;
  if (job.download_status !== 'done' || !job.cos_key) return;
  if (job.probe_status !== 'done') return;  // 需要 duration

  const provider = getStorageProvider();
  if (!hasMediaProcessing(provider)) {
    await markStep(job.id, 'frame', 'skipped');
    return;
  }

  await markStep(job.id, 'frame', 'in_progress');
  try {
    const timestamps = computeFrameTimestamps(job);
    const prefix = `${job.user_id}/frames/${job.id}/f`;
    const frames = await provider.extractFrames({
      sourceKey: job.cos_key,
      timestamps,
      outputKeyPrefix: prefix,
    });
    await markStep(job.id, 'frame', 'done', { frames });
  } catch (err) {
    await markStep(job.id, 'frame', 'failed');
  }
}

function computeFrameTimestamps(job: VideoJob): number[] {
  const chapters = job.audio_result?.chapters as any[] | undefined;
  if (chapters && chapters.length > 0) {
    return chapters.map(c => Math.round((c.start + c.end) / 2)).slice(0, 20);
  }
  // fallback: 等间隔，最多 20 帧
  const dur = job.probe_data?.durationSec ?? 0;
  if (dur <= 0) return [0];
  const count = Math.min(20, Math.max(1, Math.ceil(dur / 60)));
  return Array.from({ length: count }, (_, i) => Math.round(i * dur / count));
}
```

实现要点（analyze-visual）：
```typescript
export async function runAnalyzeVisualStep(job: VideoJob, noteTitle?: string): Promise<void> {
  if (job.visual_status !== 'pending') return;
  if (job.frame_status !== 'done' || !job.frames) return;

  const provider = getVisualAnalysisProvider();
  if (!provider) {
    await markStep(job.id, 'visual', 'skipped');
    return;
  }

  await markStep(job.id, 'visual', 'in_progress');
  try {
    const frames = (job.frames as any[]).map(f => ({ timestamp: f.timestamp, url: f.url }));
    const result = await provider.analyzeFrames({ frames, context: noteTitle });
    await markStep(job.id, 'visual', 'done', { visual_result: result });
  } catch (err) {
    await markStep(job.id, 'visual', 'failed', { visual_error: String(err) });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(worker): step-extract-frames + step-analyze-visual"
```

---

### Task 11：step-analyze-audio（TDD）

**Files:**
- Create: `lib/workers/video-pipeline/step-analyze-audio.ts`
- Test: `tests/lib/workers/video-pipeline/step-analyze-audio.test.ts`

提交 + 轮询两阶段：
- 第一次（audio_status='pending'）：调 tingwu.submit，写 audio_task_id，标 'in_progress'
- 后续轮询（audio_status='in_progress' + 有 audio_task_id）：调 tingwu.poll，
  - done → 写 audio_result，标 'done'
  - failed → 标 'failed' + retry
  - processing → 不动（下次循环继续）

测试覆盖 4 个分支 + 1 个 staleness 边界。

- [ ] **Step 1-5: TDD**

实现要点：
```typescript
export async function runAnalyzeAudioStep(job: VideoJob): Promise<void> {
  if (job.download_status !== 'done' || !job.cos_url) return;
  if (job.audio_status === 'done' || job.audio_status === 'failed') return;

  const provider = getAudioAnalysisProvider();

  if (job.audio_status === 'pending') {
    try {
      const { taskId } = await provider.submit({
        mediaUrl: job.cos_url,
        capabilities: ['transcript', 'chapters', 'summary', 'key_points', 'qa'],
        language: 'zh',
      });
      await markStep(job.id, 'audio', 'in_progress', { audio_task_id: taskId });
    } catch (err) {
      await markStep(job.id, 'audio', 'failed', { audio_error: String(err) });
      await incrementRetry(job.id);
    }
    return;
  }

  // in_progress + 有 task_id → 轮询
  if (!job.audio_task_id) return;
  try {
    const r = await provider.poll(job.audio_task_id);
    if (r.status === 'done' && r.result) {
      await markStep(job.id, 'audio', 'done', { audio_result: r.result });
    } else if (r.status === 'failed') {
      await markStep(job.id, 'audio', 'failed', {
        audio_error: r.error ? `${r.error.code}: ${r.error.message}` : 'unknown',
      });
      await incrementRetry(job.id);
    }
    // processing → 静默等下次循环
  } catch (err) {
    await markStep(job.id, 'audio', 'failed', { audio_error: String(err) });
    await incrementRetry(job.id);
  }
}
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(worker): step-analyze-audio（听悟提交 + 轮询）"
```

---

### Task 12：reconcile.ts（汇总 notes.video_overall_status）

**Files:**
- Create: `lib/workers/video-pipeline/reconcile.ts`
- Test: `tests/lib/workers/video-pipeline/reconcile.test.ts`

每次循环末尾调用，把 video_jobs 的状态聚合写到 notes.video_overall_status。

逻辑：
- 任何 step failed 且 retry_count >= 3 → 'failed'
- download_status === 'need_browser_fallback' → 'need_browser_fallback'
- download_status === 'done' && audio_status === 'done' && visual_status ∈ {done, failed, skipped} → 'fully_ready'，video_ready_at = now()
- download_status === 'done' → 'media_ready'
- 其他 → 'processing'

- [ ] **Step 1-5: TDD**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(worker): reconcile —— 汇总 notes.video_overall_status"
```

---

### Task 13：scheduler + recovery + 启动 hook（TDD）

**Files:**
- Create: `lib/workers/video-pipeline/scheduler.ts`
- Create: `lib/workers/video-pipeline/recovery.ts`
- Create: `lib/workers/index.ts`
- Create: `instrumentation.ts`（Next.js 启动 hook）
- Test: `tests/lib/workers/video-pipeline/scheduler.test.ts`

- [ ] **Step 1: scheduler.ts**

```typescript
// lib/workers/video-pipeline/scheduler.ts
import { fetchPendingJobs } from './db';
import { runDownloadStep } from './step-download';
import { runProbeAndCoverStep } from './step-probe-and-cover';
import { runExtractFramesStep } from './step-extract-frames';
import { runAnalyzeAudioStep } from './step-analyze-audio';
import { runAnalyzeVisualStep } from './step-analyze-visual';
import { reconcileJob } from './reconcile';
import type { VideoJob } from './types';

let timer: NodeJS.Timeout | null = null;
let running = false;

const INTERVAL_MS = Number(process.env.VIDEO_WORKER_INTERVAL_MS || 10_000);
const BATCH_SIZE = Number(process.env.VIDEO_WORKER_BATCH_SIZE || 5);

export function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, INTERVAL_MS);
  console.log(`[video-worker] scheduler started (interval=${INTERVAL_MS}ms)`);
}

export function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick() {
  if (running) return;  // 上一轮还没跑完，跳过本轮
  running = true;
  try {
    const jobs = await fetchPendingJobs(BATCH_SIZE);
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[video-worker] tick error', err);
  } finally {
    running = false;
  }
}

async function processJob(job: VideoJob) {
  // 顺序：download → probe & cover → audio（与 frame/visual 并行）
  await runDownloadStep(job);
  await runProbeAndCoverStep(job);
  await runAnalyzeAudioStep(job);
  await runExtractFramesStep(job);
  await runAnalyzeVisualStep(job);
  await reconcileJob(job.id);
}
```

- [ ] **Step 2: recovery.ts**

```typescript
// lib/workers/video-pipeline/recovery.ts
import { createServiceClient } from '@/lib/supabase/server-service';

/**
 * 启动时把 in_progress 但卡太久的 step 重置为 pending（防止僵死）。
 */
export async function runRecovery() {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  await supabase.from('video_jobs').update({
    download_status: 'pending',
  }).eq('download_status', 'in_progress').lt('updated_at', cutoff);
  // 同样处理其他 step（probe/cover/frame/visual）
  // audio 的 in_progress 通常是等听悟，不要重置，让正常轮询继续
  for (const col of ['probe_status', 'cover_status', 'frame_status', 'visual_status']) {
    await supabase.from('video_jobs').update({ [col]: 'pending' })
      .eq(col, 'in_progress').lt('updated_at', cutoff);
  }
  console.log('[video-worker] recovery completed');
}
```

- [ ] **Step 3: index.ts**

```typescript
// lib/workers/index.ts
import { startScheduler } from './video-pipeline/scheduler';
import { runRecovery } from './video-pipeline/recovery';

export async function startVideoWorker() {
  if (process.env.VIDEO_WORKER_ENABLED !== 'true') {
    console.log('[video-worker] disabled by env');
    return;
  }
  try {
    await runRecovery();
    startScheduler();
  } catch (err) {
    console.error('[video-worker] startup failed', err);
  }
}
```

- [ ] **Step 4: instrumentation.ts**

```typescript
// instrumentation.ts —— Next.js 15 的启动 hook
// docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startVideoWorker } = await import('@/lib/workers');
    await startVideoWorker();
  }
}
```

并在 next.config.ts 里启用 instrumentation（Next 15 默认启用，可能不用改）：
检查 `next.config.ts`，如有 `experimental.instrumentationHook` 设为 true 即可。

- [ ] **Step 5: scheduler.test.ts —— 测试 tick 调用顺序 + 防并发 + 防错误传播**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(worker): scheduler + recovery + Next.js instrumentation 启动 hook"
```

---

### Task 14：API 路由 - save-video + status + retry

**Files:**
- Create: `app/api/extension/save-video/route.ts`
- Create: `app/api/ai/video/[jobId]/status/route.ts`
- Create: `app/api/ai/video/[jobId]/retry/route.ts`

- [ ] **Step 1: save-video/route.ts**

```typescript
// app/api/extension/save-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';

interface SaveVideoBody {
  capture: {
    platform: string;
    sourceUrl: string;
    videoUrl: string;
    videoHeaders?: Record<string, string>;
    recommendedStrategy: 'server' | 'browser';
    meta: {
      title: string;
      authorName?: string;
      authorUrl?: string;
      coverUrl?: string;
      durationSec?: number;
      publishedAt?: string;
    };
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: SaveVideoBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.capture?.videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 });

  const service = createServiceClient();

  // 1. 创建 notes 记录
  const { data: note, error: noteErr } = await service.from('notes').insert({
    user_id: user.id,
    title: body.capture.meta.title,
    source_url: body.capture.sourceUrl,
    content_type: 'video',
    video_overall_status: 'processing',
    media_duration: body.capture.meta.durationSec ?? null,
    published_at: body.capture.meta.publishedAt ?? null,
    captured_at: new Date().toISOString(),
  }).select().single();
  if (noteErr || !note) return NextResponse.json({ error: noteErr?.message ?? 'note creation failed' }, { status: 500 });

  // 2. 创建 video_jobs 记录
  const { data: job, error: jobErr } = await service.from('video_jobs').insert({
    note_id: note.id,
    user_id: user.id,
    source_url: body.capture.sourceUrl,
    platform: body.capture.platform,
    source_video_url: body.capture.videoUrl,
    request_headers: body.capture.videoHeaders ?? null,
    download_strategy: body.capture.recommendedStrategy,
  }).select().single();
  if (jobErr || !job) {
    // 回滚 note
    await service.from('notes').delete().eq('id', note.id);
    return NextResponse.json({ error: jobErr?.message ?? 'job creation failed' }, { status: 500 });
  }

  // 3. note 反向关联 job
  await service.from('notes').update({ video_job_id: job.id }).eq('id', note.id);

  return NextResponse.json({ noteId: note.id, jobId: job.id });
}
```

- [ ] **Step 2: [jobId]/status/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('video_jobs')
    .select('id, download_status, probe_status, cover_status, frame_status, audio_status, visual_status, cover_url, download_error, audio_error, visual_error, retry_count, note_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    jobId: data.id,
    noteId: data.note_id,
    steps: {
      download: data.download_status,
      probe: data.probe_status,
      cover: data.cover_status,
      frame: data.frame_status,
      audio: data.audio_status,
      visual: data.visual_status,
    },
    coverUrl: data.cover_url,
    errors: {
      download: data.download_error,
      audio: data.audio_error,
      visual: data.visual_error,
    },
    retryCount: data.retry_count,
  });
}
```

- [ ] **Step 3: [jobId]/retry/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const service = createServiceClient();
  // 把任何 failed 的 step 改为 pending
  const updates: Record<string, string> = {};
  const { data: job } = await service.from('video_jobs').select('*').eq('id', jobId).eq('user_id', user.id).single();
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  for (const col of ['download_status', 'probe_status', 'cover_status', 'frame_status', 'audio_status', 'visual_status']) {
    if (job[col] === 'failed') updates[col] = 'pending';
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no failed steps to retry' }, { status: 400 });
  }
  await service.from('video_jobs').update({ ...updates, retry_count: 0, next_retry_at: null }).eq('id', jobId);
  return NextResponse.json({ ok: true, retriedSteps: Object.keys(updates) });
}
```

- [ ] **Step 4: lint + typecheck + 启 dev 看编译过**

- [ ] **Step 5: Commit**

```bash
git add app/api/extension/save-video/ app/api/ai/video/
git commit -m "feat(api): save-video / video status / video retry 三个路由"
```

---

### Task 15：API 路由 - upload-cred + upload-done（B 路径）

**Files:**
- Create: `app/api/extension/video-upload-cred/route.ts`
- Create: `app/api/extension/video-upload-done/route.ts`

- [ ] **Step 1: upload-cred/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { getStorageProvider, buildStorageKey } from '@/lib/storage';

interface Body {
  capture: any; // 同 save-video 的 capture
  ext: string;
  contentType: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.capture?.videoUrl) return NextResponse.json({ error: 'capture.videoUrl required' }, { status: 400 });

  const service = createServiceClient();

  // 创建 notes + job（同 save-video 但 download_strategy='browser', download_status='in_progress'）
  const { data: note } = await service.from('notes').insert({
    user_id: user.id,
    title: body.capture.meta.title,
    source_url: body.capture.sourceUrl,
    content_type: 'video',
    video_overall_status: 'processing',
    captured_at: new Date().toISOString(),
  }).select().single();
  if (!note) return NextResponse.json({ error: 'note creation failed' }, { status: 500 });

  const key = buildStorageKey({ userId: user.id, kind: 'videos', ext: body.ext });
  const { data: job } = await service.from('video_jobs').insert({
    note_id: note.id,
    user_id: user.id,
    source_url: body.capture.sourceUrl,
    platform: body.capture.platform,
    source_video_url: body.capture.videoUrl,
    download_strategy: 'browser',
    download_status: 'in_progress',
    cos_key: key,
  }).select().single();
  if (!job) {
    await service.from('notes').delete().eq('id', note.id);
    return NextResponse.json({ error: 'job creation failed' }, { status: 500 });
  }
  await service.from('notes').update({ video_job_id: job.id }).eq('id', note.id);

  const cred = await getStorageProvider().createUploadCredential({
    key,
    contentType: body.contentType,
    expiresIn: 3600,
  });

  return NextResponse.json({
    jobId: job.id,
    noteId: note.id,
    cosKey: key,
    uploadUrl: cred.uploadUrl,
    method: cred.method,
    headers: cred.headers,
    publicUrl: cred.publicUrl,
    expiresAt: cred.expiresAt,
  });
}
```

- [ ] **Step 2: upload-done/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { getStorageProvider } from '@/lib/storage';

interface Body { jobId: string; cosKey: string; sizeBytes: number; }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.jobId || !body.cosKey) return NextResponse.json({ error: 'jobId + cosKey required' }, { status: 400 });

  const provider = getStorageProvider();
  // 验证对象真的存在
  const exists = await provider.exists(body.cosKey);
  if (!exists) return NextResponse.json({ error: 'object not found in COS' }, { status: 400 });

  const cosUrl = provider.getPublicUrl(body.cosKey);
  const service = createServiceClient();
  const { error } = await service.from('video_jobs').update({
    download_status: 'done',
    cos_url: cosUrl,
    size_bytes: body.sizeBytes,
  }).eq('id', body.jobId).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 同步 notes.media_url
  const { data: job } = await service.from('video_jobs').select('note_id').eq('id', body.jobId).single();
  if (job) await service.from('notes').update({ media_url: cosUrl }).eq('id', job.note_id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: lint + typecheck + 启 dev 看编译过**

- [ ] **Step 4: Commit**

```bash
git add app/api/extension/video-upload-cred/ app/api/extension/video-upload-done/
git commit -m "feat(api): video-upload-cred + video-upload-done（B 路径浏览器直传）"
```

---

### Task 16：API 路由 - ai/video/ask（交互问答）

**Files:**
- Create: `app/api/ai/video/ask/route.ts`

- [ ] **Step 1: 实现**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server-service';
import { askVideoQuestion } from '@/lib/ai-analysis/qa-service';

interface Body {
  noteId: string;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: Body = await req.json();
  if (!body.noteId || !body.question) return NextResponse.json({ error: 'noteId + question required' }, { status: 400 });

  const service = createServiceClient();
  const { data: job } = await service
    .from('video_jobs')
    .select('audio_result')
    .eq('note_id', body.noteId)
    .eq('user_id', user.id)
    .single();
  if (!job?.audio_result?.transcript) return NextResponse.json({ error: 'transcript not ready' }, { status: 400 });

  try {
    const r = await askVideoQuestion({
      transcript: job.audio_result.transcript,
      question: body.question,
      history: body.history,
    });
    return NextResponse.json({ answer: r.answer });
  } catch (err) {
    console.error('[ai/video/ask]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'qa failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: lint + typecheck**

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/video/ask/
git commit -m "feat(api): /api/ai/video/ask 交互式问答路由"
```

---

## Phase 1 收尾：环境变量补全 + Phase 1 集成验收

### Task 17：补 .env.example + CLAUDE.md + 集成跑 dev

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 在 `.env.example` 末尾追加 AI + worker 段**

```bash
# === AI 分析（视频） ===
AUDIO_ANALYSIS_PROVIDER=tingwu
VISUAL_ANALYSIS_PROVIDER=qwen-vl

# 阿里通义听悟
ALI_TINGWU_APPKEY=
ALIBABA_CLOUD_ACCESS_KEY_ID=
ALIBABA_CLOUD_ACCESS_KEY_SECRET=
ALIBABA_CLOUD_REGION=cn-beijing

# DashScope（千问 + Qwen-VL）
DASHSCOPE_API_KEY=
DASHSCOPE_TEXT_MODEL=qwen-plus
DASHSCOPE_VISION_MODEL=qwen-vl-max

# 视频 worker
VIDEO_WORKER_ENABLED=true
VIDEO_WORKER_INTERVAL_MS=10000
VIDEO_WORKER_BATCH_SIZE=5

# Supabase Service Role（worker 用，bypass RLS）
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: CLAUDE.md 增加段落**

在合适位置（如 Project Architecture 段落）添加：

```markdown
### 视频流水线（Plan B）
- **数据**: `video_jobs` 表追踪每个视频笔记的处理状态（download / probe / cover / frame / audio / visual）
- **Worker**: `lib/workers/video-pipeline/` 在 Next.js 同进程内 setInterval 推进状态机
- **AI 分析**: `lib/ai-analysis/` 提供 AudioAnalysisProvider（听悟）和 VisualAnalysisProvider（Qwen-VL）
- **API**: `/api/extension/save-video` (A 路径) + `/api/extension/video-upload-cred` + `/api/extension/video-upload-done` (B 路径)
- **状态轮询**: `/api/ai/video/[jobId]/status`
- **重试**: `/api/ai/video/[jobId]/retry`
- **Q&A**: `/api/ai/video/ask`
```

- [ ] **Step 3: 全套件回归**

```bash
npm test  # 全部应过（Plan A 37 个 + Plan B 新增）
npm run build  # 必须成功
```

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: 补充视频流水线环境变量与架构说明"
```

✅ **Phase 1 完成**：后端基础设施就绪。可以通过手动构造 video_jobs 记录（用 SQL 或 supabase studio）端到端跑视频流水线。

---

## Phase 2：浏览器插件（Tasks 18-22）

### Task 18：插件 video-extractors 接口 + 注册表

**Files:**
- Create: `extension/src/content/video-extractors/base.ts`
- Create: `extension/src/content/video-extractors/index.ts`

- [ ] **Step 1: base.ts**

```typescript
// extension/src/content/video-extractors/base.ts
export type Platform = 'douyin' | 'bilibili' | 'weibo' | 'kuaishou' | 'weixin-channel';

export interface VideoCapture {
  platform: Platform;
  sourceUrl: string;
  videoUrl: string;
  videoHeaders?: Record<string, string>;
  recommendedStrategy: 'server' | 'browser';
  meta: {
    title: string;
    authorName?: string;
    authorUrl?: string;
    coverUrl?: string;
    durationSec?: number;
    publishedAt?: string;
  };
}

export interface IVideoExtractor {
  platform: Platform;
  matches(url: string, doc: Document): boolean;
  extract(): Promise<VideoCapture>;
}

export class VideoExtractionError extends Error {
  constructor(public readonly platform: Platform, message: string) {
    super(`[${platform}] ${message}`);
  }
}
```

- [ ] **Step 2: index.ts（注册表）**

```typescript
// extension/src/content/video-extractors/index.ts
import type { IVideoExtractor, VideoCapture } from './base';
import { DouyinExtractor } from './douyin';
import { KuaishouExtractor } from './kuaishou';
import { WeiboExtractor } from './weibo';
import { BilibiliExtractor } from './bilibili';
import { WeixinChannelExtractor } from './weixin-channel';

const REGISTRY: IVideoExtractor[] = [
  new DouyinExtractor(),
  new KuaishouExtractor(),
  new WeiboExtractor(),
  new BilibiliExtractor(),
  new WeixinChannelExtractor(),
];

export function findExtractor(url: string, doc: Document = document): IVideoExtractor | null {
  return REGISTRY.find(e => e.matches(url, doc)) ?? null;
}

export async function extractVideoCapture(url: string, doc: Document = document): Promise<VideoCapture | null> {
  const extractor = findExtractor(url, doc);
  if (!extractor) return null;
  return await extractor.extract();
}

export type { VideoCapture, Platform } from './base';
```

- [ ] **Step 3: Commit**

```bash
git add extension/src/content/video-extractors/base.ts extension/src/content/video-extractors/index.ts
git commit -m "feat(extension): video-extractors 基础接口 + 注册表"
```

---

### Task 19：5 个平台 extractor（逐个 TDD）

Each platform 是一个 1-2 小时的 reverse-engineering task。生产质量需用真实页面 + 浏览器开发者工具看 DOM/network。本 plan 给最小可行骨架，**实施者需用浏览器实际访问平台页面（用 dev 账号）逐个验证**。

**Files:**
- Create: 5 个 platform extractor 文件
- Test: 5 个 test fixture（HTML 片段）

#### Sub-task 19.1: Douyin（A 路径，最简单）

抖音 PC 页面 URL 模式：`https://www.douyin.com/video/{aweme_id}`

提取策略：从全局 `window._ROUTER_DATA` 或 `<video>` 标签 src 拿直链 mp4。

```typescript
// extension/src/content/video-extractors/douyin.ts
import { IVideoExtractor, VideoCapture, VideoExtractionError } from './base';

export class DouyinExtractor implements IVideoExtractor {
  platform = 'douyin' as const;

  matches(url: string): boolean {
    return /douyin\.com\/video\//.test(url);
  }

  async extract(): Promise<VideoCapture> {
    const url = window.location.href;
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video?.src) {
      throw new VideoExtractionError(this.platform, 'video element src not found');
    }

    const title =
      document.querySelector('h1')?.textContent?.trim()
      ?? document.title;

    const authorName = document.querySelector('a[href*="/user/"]')?.textContent?.trim();
    const coverUrl = video.poster || undefined;

    return {
      platform: this.platform,
      sourceUrl: url,
      videoUrl: video.src,
      videoHeaders: { Referer: 'https://www.douyin.com/' },
      recommendedStrategy: 'server',
      meta: { title: title || '抖音视频', authorName, coverUrl },
    };
  }
}
```

测试：用 fixture HTML（含 `<video src="...">`） 模拟，验证 extract() 输出正确 VideoCapture。

#### Sub-task 19.2-19.5: kuaishou / weibo / bilibili / weixin-channel

每个类似：
- `matches()`: URL 模式匹配
- `extract()`: 实际 DOM 操作
- `recommendedStrategy`: kuaishou/weibo 走 'server'，bilibili/weixin-channel 走 'browser'

**Note**：B 站需要拼 m3u8 url 或读 window 全局对象 `__playinfo__`；视频号防爬严，需要监听 `<video>` 的 `srcObject`/blob URL，可能需 service worker 介入。这两个**只给最小占位**，实施者要自己验证：

```typescript
// bilibili.ts —— 占位骨架
export class BilibiliExtractor implements IVideoExtractor {
  platform = 'bilibili' as const;
  matches(url: string): boolean { return /bilibili\.com\/video\//.test(url); }
  async extract(): Promise<VideoCapture> {
    // TODO: 从 window.__playinfo__ 或 (window as any).__INITIAL_STATE__ 读取
    const playinfo = (window as any).__playinfo__;
    if (!playinfo) throw new VideoExtractionError(this.platform, '__playinfo__ not found');
    // dash/durl 视格式而定；这里假设 dash:
    const videoUrl = playinfo?.data?.dash?.video?.[0]?.baseUrl
      || playinfo?.data?.durl?.[0]?.url;
    if (!videoUrl) throw new VideoExtractionError(this.platform, 'video url not in playinfo');
    return {
      platform: this.platform,
      sourceUrl: window.location.href,
      videoUrl,
      videoHeaders: { Referer: 'https://www.bilibili.com/' },
      recommendedStrategy: 'browser', // m3u8 + 防盗链严，走 B 路径
      meta: { title: document.title.replace(/_哔哩哔哩.*$/, '') },
    };
  }
}
```

**实施者必读**：每个 extractor 上线前必须用真实浏览器在对应平台跑通至少 3 个不同视频。

- [ ] **Step**: 每个 extractor 一个 commit：`feat(extension): {platform} video extractor`

---

### Task 20：插件 popup 增加视频保存 UI

**Files:**
- Modify: `extension/src/popup/App.tsx`（或对应入口）
- Create: `extension/src/popup/components/VideoSaveView.tsx`（如有 SaveView 模式可复用）

- [ ] **Step 1: 在 popup 入口检测平台**

popup 加载时通过 `chrome.tabs.query({active:true})` 拿当前 tab URL → 调 `findExtractor` 判断 → 显示"保存视频"按钮。

- [ ] **Step 2: VideoSaveView 组件**

按下"保存视频"：
1. 调 `chrome.scripting.executeScript` 在当前 tab 执行 `extractVideoCapture()` 拿 capture
2. 根据 `recommendedStrategy` 走两条路径之一：
   - 'server': POST `/api/extension/save-video` → 拿到 noteId → 显示"已加入笔记库"
   - 'browser': POST `/api/extension/video-upload-cred` → 把 cred + capture 发给 background service worker → popup 立即显示"已加入笔记库"

```tsx
// extension/src/popup/components/VideoSaveView.tsx
import { useState, useEffect } from 'react';
import { api } from '@shared/api';

export function VideoSaveView({ tabUrl, capture }: { tabUrl: string; capture: any }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus('saving');
    try {
      if (capture.recommendedStrategy === 'server') {
        await api.saveVideo({ capture });
      } else {
        // 委托给 background service worker
        const cred = await api.requestUploadCred({ capture, ext: 'mp4', contentType: 'video/mp4' });
        chrome.runtime.sendMessage({
          type: 'video:browser-upload',
          capture,
          cred,
        });
      }
      setStatus('saved');
      setTimeout(() => window.close(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <div className="p-4">
      <div className="text-sm font-medium mb-2">检测到视频：{capture.meta.title}</div>
      <button
        disabled={status === 'saving'}
        onClick={save}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {status === 'saving' ? '正在保存...' : '保存到笔记库'}
      </button>
      {status === 'saved' && <div className="mt-2 text-green-600">✓ 已加入笔记库</div>}
      {status === 'error' && <div className="mt-2 text-red-600">失败：{error}</div>}
    </div>
  );
}
```

- [ ] **Step 3: 在 shared/api.ts 加 saveVideo / requestUploadCred / reportUploadDone 三个方法**

- [ ] **Step 4: 重新 build 插件**

```bash
cd extension && npm run build
```

确认无 build error。

- [ ] **Step 5: Commit**

```bash
git add extension/
git commit -m "feat(extension): popup 视频保存 UI（A/B 路径分发）"
```

---

### Task 21：插件 background service worker - B 路径浏览器下载

**Files:**
- Create: `extension/src/background/video-uploader.ts`
- Modify: `extension/src/background/service-worker.ts`

收到 popup 的 `video:browser-upload` 消息后：
1. 用 `chrome.alarms` 注册心跳 keepalive
2. `fetch(capture.videoUrl, {headers: capture.videoHeaders})` 拿视频字节
3. 把字节 PUT 到 `cred.uploadUrl`（COS 直传）
4. 完成后 POST `/api/extension/video-upload-done`

```typescript
// extension/src/background/video-uploader.ts
import { api } from '@shared/api';

export async function uploadVideoBytes(capture: any, cred: any): Promise<void> {
  // 1. keep service worker alive
  chrome.alarms.create('video-upload-heartbeat', { periodInMinutes: 0.5 });

  try {
    // 2. fetch video
    const res = await fetch(capture.videoUrl, { headers: capture.videoHeaders ?? {} });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const blob = await res.blob();

    // 3. PUT to COS
    const putRes = await fetch(cred.uploadUrl, {
      method: cred.method,
      headers: cred.headers,
      body: blob,
    });
    if (!putRes.ok) throw new Error(`cos PUT failed: ${putRes.status}`);

    // 4. 通知后端
    await api.reportUploadDone({
      jobId: cred.jobId,
      cosKey: cred.cosKey,
      sizeBytes: blob.size,
    });

    // 5. 通知（可选）
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'NewsBox',
      message: `视频上传完成：${capture.meta.title}`,
    });
  } catch (err) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'NewsBox 视频上传失败',
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    chrome.alarms.clear('video-upload-heartbeat');
  }
}
```

service-worker.ts 加 message handler：

```typescript
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === 'video:browser-upload') {
    uploadVideoBytes(msg.capture, msg.cred);
  }
});
```

- [ ] **Step 1-2: 实现 + service-worker 注册**

- [ ] **Step 3: build + 手动测试（用一个小视频走 B 路径）**

- [ ] **Step 4: Commit**

```bash
git add extension/src/background/
git commit -m "feat(extension): background service worker B 路径上传"
```

✅ **Phase 2 完成**：插件能从 5 个平台抓视频并触发后端流水线。

---

## Phase 3：Reader UX（Tasks 22-25）

### Task 22：Reader 数据层 join video_jobs + VideoChapters 增强 + Tabs 化右栏

**Files:**
- Modify: Reader page 数据 fetch（具体路径用 grep 定位，可能是 `app/notes/[id]/page.tsx` 或 `components/reader/ReaderPageWrapper.tsx`）
- Modify: `components/reader/LeftSidebar/VideoChapters.tsx`
- Modify: `components/reader/RightSidebar/index.tsx`
- Modify: `components/reader/RightSidebar/TranscriptView.tsx`
- Modify: Reader 相关 TypeScript 类型（如 `components/reader/types.ts` 或 inline note interface）

- [ ] **Step 0: 找到并扩展 Reader 的数据 fetch**

⚠️ **关键前置**：现有 Reader 只 fetch `notes` 一行，新加的视频字段（章节/Q&A/帧/视觉）都在 `video_jobs` 表里，必须先扩展 fetch。

```bash
grep -rn "from('notes')" app/notes app/(.)*\\(reader\\) components/reader 2>/dev/null | head -10
```

定位到主 fetch 后，把 select 改成 join 形式：

```typescript
// 原：
const { data: note } = await supabase
  .from('notes')
  .select('*')
  .eq('id', noteId)
  .single();

// 新：
const { data: note } = await supabase
  .from('notes')
  .select(`
    *,
    video_job:video_jobs!notes_video_job_id_fkey(
      id, audio_result, visual_result, frames, cover_url, cos_url,
      download_status, audio_status, visual_status
    )
  `)
  .eq('id', noteId)
  .single();
```

（Supabase 自动 join via foreign key；如关系名需调，参考 supabase studio 中 `notes.video_job_id → video_jobs.id` 的 FK 名）

同时扩展 Reader 的 Note interface（`title` / `media_url` 等所在文件）加：

```typescript
interface VideoJobRow {
  id: string;
  audio_result: AudioAnalysisResult | null;
  visual_result: VisualFrameAnalysis[] | null;
  frames: Array<{ timestamp: number; key: string; url: string }> | null;
  cover_url: string | null;
  cos_url: string | null;
  download_status: string;
  audio_status: string;
  visual_status: string;
}

interface Note {
  // ... 现有字段
  video_job?: VideoJobRow | null;
}
```

`AudioAnalysisResult` 和 `VisualFrameAnalysis` 从 `@/lib/ai-analysis` import。

- [ ] **Step 1: VideoChapters 改为读 audio_result.chapters**

```tsx
// 关键改动
const chapters = note.video_job?.audio_result?.chapters ?? [];
return chapters.map((c: Chapter) => (
  <button onClick={() => seekTo(c.start)}>
    <div>{c.title}</div>
    <div className="text-xs text-muted-foreground">{formatTime(c.start)} - {formatTime(c.end)}</div>
  </button>
));
```

- [ ] **Step 2: RightSidebar 改为 Radix Tabs**

```tsx
<Tabs defaultValue="transcript">
  <TabsList>
    <TabsTrigger value="transcript">转写</TabsTrigger>
    <TabsTrigger value="qa">Q&A</TabsTrigger>
    <TabsTrigger value="visual">画面</TabsTrigger>
    <TabsTrigger value="annotations">批注</TabsTrigger>
  </TabsList>
  <TabsContent value="transcript"><TranscriptView ... /></TabsContent>
  <TabsContent value="qa"><QAPanel note={note} /></TabsContent>
  <TabsContent value="visual"><VisualFrames frames={...} /></TabsContent>
  <TabsContent value="annotations"><AnnotationList ... /></TabsContent>
</Tabs>
```

- [ ] **Step 3: TranscriptView 显示说话人**

```tsx
{segments.map(s => (
  <div className="flex gap-2">
    {s.speaker && <span className="text-xs font-semibold">{s.speaker}</span>}
    <span>{s.text}</span>
  </div>
))}
```

- [ ] **Step 4: lint + dev 启动验证**

确认：
- Reader 页面打开非视频笔记仍正常（`note.video_job` 为 null 不报错）
- 视频笔记 Reader 能渲染章节（即使 audio_result 暂为 null 也不应崩溃，要做 fallback）

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(reader): 数据层 join video_jobs + VideoChapters 自动章节 + RightSidebar Tabs 化"
```

---

### Task 23：新增 QAPanel.tsx

**Files:**
- Create: `components/reader/RightSidebar/QAPanel.tsx`

```tsx
"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message { role: 'user' | 'assistant'; content: string; }

export function QAPanel({ noteId, prebuiltQAs }: {
  noteId: string;
  prebuiltQAs: Array<{ q: string; a: string }>;
}) {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    setHistory(h => [...h, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/video/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, question: q, history }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { answer } = await res.json();
      setHistory(h => [...h, { role: 'assistant', content: answer }]);
    } catch (err) {
      setHistory(h => [...h, { role: 'assistant', content: `失败：${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* 预生成 Q&A */}
      <details>
        <summary className="cursor-pointer text-sm font-medium mb-2">预生成问答 ({prebuiltQAs.length})</summary>
        <div className="space-y-2">
          {prebuiltQAs.map((qa, i) => (
            <div key={i} className="text-sm border-l-2 border-muted pl-2">
              <div className="font-medium">{qa.q}</div>
              <div className="text-muted-foreground">{qa.a}</div>
            </div>
          ))}
        </div>
      </details>

      {/* 聊天历史 */}
      <div className="flex-1 overflow-auto space-y-2">
        {history.map((m, i) => (
          <div key={i} className={`text-sm p-2 rounded ${m.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-muted'}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-sm text-muted-foreground">思考中...</div>}
      </div>

      {/* 输入 */}
      <div className="flex gap-2 border-t pt-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="问关于这个视频的问题..."
        />
        <Button onClick={send} disabled={loading}>发送</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 1-2: 实现 + 在 RightSidebar 接入**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(reader): QAPanel 交互式问答面板"
```

---

### Task 24：新增 VisualFrames.tsx

**Files:**
- Create: `components/reader/RightSidebar/VisualFrames.tsx`

```tsx
"use client";
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface FrameData {
  timestamp: number;
  url: string;
  sceneDescription?: string;
  entities?: string[];
  onScreenText?: string;
}

export function VisualFrames({ frames, onSeek }: {
  frames: FrameData[];
  onSeek: (time: number) => void;
}) {
  if (frames.length === 0) {
    return <div className="p-4 text-center text-muted-foreground text-sm">画面理解暂不可用</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {frames.map((f, i) => (
        <div key={i} className="space-y-1 cursor-pointer group" onClick={() => onSeek(f.timestamp)}>
          <div className="relative aspect-video rounded overflow-hidden">
            <img src={f.url} alt="" className="w-full h-full object-cover group-hover:opacity-80 transition" referrerPolicy="no-referrer" />
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
              {Math.floor(f.timestamp / 60)}:{String(f.timestamp % 60).padStart(2, '0')}
            </div>
          </div>
          {f.sceneDescription && <div className="text-xs">{f.sceneDescription}</div>}
          {f.entities && f.entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {f.entities.slice(0, 5).map(e => (
                <Badge key={e} variant="secondary" className="text-[10px] px-1.5 py-0">{e}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 1: 实现 + 在 RightSidebar 接入（frames 来自 `video_jobs.frames` + `visual_result` join）**

数据 join 逻辑：
```typescript
const visualByTs = new Map((visual_result ?? []).map(v => [v.timestamp, v]));
const merged = (frames ?? []).map(f => ({
  ...f,
  ...visualByTs.get(f.timestamp),
}));
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(reader): VisualFrames 关键帧画廊 + 场景描述 + 实体"
```

---

### Task 25：Dashboard 视频卡片状态指示 + 轮询

**Files:**
- Modify: `components/dashboard/dashboard-content.tsx`

视频笔记卡片读 `notes.video_overall_status`：
- processing → "视频处理中" + 旋转图标
- media_ready → "AI 分析中"
- fully_ready → 正常显示
- failed → "处理失败，点击重试"
- need_browser_fallback → "请打开插件重试"

未达 fully_ready 的卡片每 10 秒轮询 `/api/ai/video/[jobId]/status`，状态变化时更新本地状态（用 SWR 或 polling hook）。

- [ ] **Step 1: 在卡片渲染处加状态 badge**

```tsx
{note.content_type === 'video' && note.video_overall_status && note.video_overall_status !== 'fully_ready' && (
  <StatusBadge status={note.video_overall_status} onRetry={() => retryJob(note.video_job_id)} />
)}
```

- [ ] **Step 2: 加轮询 hook**

```tsx
function useVideoJobStatus(jobId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<any>(null);
  useEffect(() => {
    if (!enabled || !jobId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/ai/video/${jobId}/status`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [jobId, enabled]);
  return status;
}
```

- [ ] **Step 3: lint + dev**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(dashboard): 视频卡片状态指示 + 10s 轮询"
```

✅ **Phase 3 完成**：完整 UX 落地。

---

## Phase 4：验收（Task 26）

### Task 26：端到端手动验收

**前置条件**（用户提供）：
- 腾讯云 COS 4 个 env 已配
- 阿里 ALI_TINGWU_APPKEY + ACCESS_KEY 已配
- DashScope DASHSCOPE_API_KEY 已配
- SUPABASE_SERVICE_ROLE_KEY 已配
- 023 + 024 两个 migration 已在 Supabase Dashboard 执行
- 插件已 build 并加载到 Chrome

**验收清单：**

- [ ] 在抖音页面点保存 → 笔记库 1 秒内出现卡片（status=processing）
- [ ] 60-120 秒后 → 卡片变 media_ready → fully_ready
- [ ] 点开笔记 Reader 显示：
  - 左栏自动生成的章节（≥1 个）
  - 视频可播放（COS URL）
  - 转写 tab 显示带说话人的字幕
  - Q&A tab 显示 ≥3 个预生成问答 + 可对话
  - 画面 tab 显示 ≥1 张关键帧 + 场景描述
- [ ] B 站 / 视频号视频走 B 路径，插件后台下载完成（看 chrome 通知），后续流程同上
- [ ] 故意断网模拟下载失败 → 卡片显示"处理失败，点击重试" → 点重试恢复
- [ ] AI snapshot / 图文转存仍正常（无 Plan A 回归）

如有任何项不通过：记录现象 → 排查是 worker 卡了、API 报错、还是 mock 数据与真实数据 schema 不一致 → 修复后回到对应 task 增加单测覆盖。

✅ Plan B 完成。

---

## Plan B 完成定义（DoD）

- [x] 数据库 video_jobs + notes 字段已迁移
- [x] lib/ai-analysis 全套（types + tingwu + qwen-vl + qa-service + 工厂 + barrel）
- [x] lib/workers/video-pipeline 全套（types + db + 6 个 step + reconcile + recovery + scheduler）
- [x] Next.js instrumentation 启动 worker
- [x] 6 个新 API 路由全部实现
- [x] 5 个平台 extractor + popup UI + background uploader
- [x] Reader 3 个新 tab（QAPanel / VisualFrames + 增强 TranscriptView）
- [x] VideoChapters 自动章节
- [x] Dashboard 视频卡片状态轮询
- [x] 单元测试覆盖率 > 70%（核心 step + adapter + service）
- [x] `npm run build` 成功
- [x] 真实视频端到端验收（5 平台 × 1 视频）通过

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 听悟 OpenAPI 字段名与 mock 不一致 | spike 验证 + 单测易于调整；先用 fake response 跑通后接真实 API 微调 |
| Q&A 能力不在 OpenAPI 暴露 | submit 时不传 `qa` capability；qa-service 仍独立可用 |
| 抖音/快手/微博 服务端 IP 被反盗链拦 | step-download 已实现 403 → need_browser_fallback；插件可拦截重做 |
| B 站 m3u8 多分片 | 暂仅支持 single mp4/m3u8；多分片场景留 Phase 4 backlog |
| 听悟单次任务最长 5 小时 | 由听悟侧拒绝，markStep 'failed' 用户看到错误码 |
| Qwen-VL 200 帧 token 爆 | 已限制 20 帧；超出时舍弃尾部 |
| Worker 内存泄漏 | scheduler.tick 防并发 + try/finally 释放 |
| 单进程 worker 重启丢任务 | recovery 在启动时把 stale in_progress 重置为 pending |

---

## Open Question 跟踪

**Q1（来自 spec）：通义听悟"高阶 Q&A"能力是否在 OpenAPI 暴露？**

- 实施 Task 3 前先做 1-2 小时 spike
- 如不可用 → Task 3 的 buildCapabilityParameters 不传 `AskQuestionEnabled`，qa-service 仍可用（基于 transcript 走 Qwen-Plus）
- 这是已知风险，不阻塞 plan
