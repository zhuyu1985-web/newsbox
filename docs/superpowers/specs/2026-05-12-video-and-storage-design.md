# NewsBox 视频抓取 + 多云存储抽象 · 设计文档

| 字段 | 值 |
|---|---|
| 日期 | 2026-05-12 |
| 状态 | Draft — 待评审 |
| 作者 | zhuyu1985@gmail.com（通过 Claude Code 协作） |
| 范围 | 两个子项目：(A) 多云对象存储抽象层、(B) 视频新闻抓取 + 展示 + AI 分析 |
| 依赖关系 | A 是 B 的前置基础设施 |
| 部署目标 | 腾讯云 CVM（生产）+ 本地（开发），**非 Serverless** |

---

## 1. 目标与非目标

### 1.1 Goals

- 把所有"对象存储"调用收敛到统一抽象层，可通过环境变量切换后端，不改业务代码
- 首发落地腾讯云 COS 作为唯一写入后端（含数据万象 CI 视频处理能力）
- 在浏览器插件中扩展视频抓取能力，覆盖 5 个主流国内平台（抖音、B站、微博、快手、微信视频号）
- 全流程零人工：用户在平台页点保存 → NewsBox 自动完成下载/存储/AI 分析/展示
- 视频笔记接入 Reader，提供章节、转写、Q&A、画面分析四类 AI 能力的统一展示
- 用户感知一致：popup 永远 1 秒内返回，长任务全部走异步队列

### 1.2 Non-Goals (YAGNI)

- ❌ yt-dlp / 服务端解析平台页面（替代方案：浏览器插件提取直链）
- ❌ Volcengine TOS 完整适配器（仅留接口签名，便于未来扩展）
- ❌ 多租户 / 按用户路由存储（全局单后端足够）
- ❌ 签名 URL / 私有 bucket（全部 public-read + 不可猜路径）
- ❌ Knowledge Graph 集成（等知识库技术方案明确后另立项）
- ❌ Q&A 时间戳跳转（下一迭代）
- ❌ 视频转码 / 多清晰度切换
- ❌ 视频下载进度条暴露给 popup（用户只看到笔记卡片的状态文字）
- ❌ Webhook 回调（统一轮询，本地/内网都能跑）
- ❌ Supabase Storage 存量数据迁移（老链接保持只读可用）
- ❌ Tencent ASR 作为听悟 fallback（听悟一家承担所有音频/文本分析）

---

## 2. 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│  浏览器插件（基础架构已存在）                                       │
│  ├─ content/extractor.ts               （现有，图文）              │
│  ├─ content/video-extractors/          （新增，5 平台 adapter）    │
│  └─ background/service-worker.ts       （扩展：B 路径后台下载）    │
└──────────────┬───────────────────────────────────────────────────┘
               │ POST /api/extension/save-video {videoUrl, headers, meta}
               │ 或 PUT 直传 COS（B 路径，服务端签发凭证）
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 应用（腾讯云 CVM）                                         │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐│
│  │  HTTP 层              │   │  同进程后台 worker                ││
│  │  /api/extension/*     │   │  - setInterval 扫 video_jobs    ││
│  │  /api/capture/*       │   │  - 状态机推进                    ││
│  │  /api/ai/video/*      │   │  - 启动恢复                      ││
│  └─────┬────────────────┘   └──────────┬──────────────────────┘│
│        │                                │                       │
│        ├──────────┬─────────────────────┤                       │
│        ▼          ▼                     ▼                       │
│  ┌───────────┐ ┌──────────────────┐ ┌──────────────────────┐   │
│  │ Storage   │ │ AIAnalysis       │ │ 视频下载 / 转码        │   │
│  │ Provider  │ │ Provider         │ │ （复用 COS CI）        │   │
│  │ (子项目 A)│ │ (子项目 B)       │ │                       │   │
│  └─────┬─────┘ └────────┬─────────┘ └──────────────────────┘   │
└────────┼────────────────┼───────────────────────────────────────┘
         │                │
         ▼                ▼
   ┌──────────┐   ┌──────────────────────────┐
   │Tencent   │   │ 阿里通义听悟（Tingwu）    │
   │  COS     │   │ + 通义千问 / Qwen-VL     │
   │ +数据万象 │   │ （DashScope）             │
   └──────────┘   └──────────────────────────┘
```

### 2.1 子项目分解

| 子项目 | 范围 | 依赖 |
|---|---|---|
| **A. 多云对象存储抽象层** | StorageProvider 接口、Supabase legacy 适配器、Tencent COS 适配器、URL 兼容识别、数据万象 CI 调用封装 | 无 |
| **B. 视频抓取 + AI 分析** | 浏览器插件视频提取、video_jobs 状态机、后台 worker、AIAnalysisProvider 接口、听悟/Qwen-VL 适配器、Reader UX 改造 | 依赖 A |

A 必须先完成，B 才能开工。两份独立的 OpenSpec change 落地。

---

## 3. 子项目 A：多云对象存储抽象层

### 3.1 目录结构

```
lib/storage/
├── types.ts              # 接口和类型定义
├── provider.ts           # 工厂方法 getStorageProvider()
├── url.ts                # URL 解析/识别（区分 supabase / cos / 外链）
├── adapters/
│   ├── supabase.ts       # 现有 Supabase Storage 适配器（读+写）
│   ├── tencent-cos.ts    # 腾讯云 COS 适配器（读+写+CI 能力）
│   └── volcengine-tos.ts # 火山引擎 TOS（仅接口签名 stub，不实现）
└── index.ts              # 对外统一导出
```

### 3.2 核心接口

```typescript
// lib/storage/types.ts
export interface StorageProvider {
  readonly name: 'supabase' | 'tencent-cos' | 'volcengine-tos';

  upload(input: {
    key: string;
    body: Buffer | ReadableStream | Blob;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ url: string; key: string; size: number }>;

  createUploadCredential(input: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<{
    uploadUrl: string;
    method: 'PUT' | 'POST';
    headers?: Record<string, string>;
    publicUrl: string;
  }>;

  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Tencent COS 适配器额外暴露的能力（接口隔离，业务侧按需断言）
export interface MediaProcessingCapability {
  extractFrames(input: {
    sourceKey: string;
    timestamps: number[];
    outputKeyPrefix: string;
  }): Promise<Array<{ timestamp: number; key: string; url: string }>>;

  generateSpriteSheet(input: {
    sourceKey: string;
    outputKey: string;
    rows: number; cols: number;
  }): Promise<{ key: string; url: string; vttKey?: string }>;

  generateSmartCover(input: {
    sourceKey: string;
    outputKey: string;
  }): Promise<{ key: string; url: string }>;

  probe(sourceKey: string): Promise<{
    durationSec: number;
    width: number; height: number;
    videoCodec: string; audioCodec: string;
    sizeBytes: number;
  }>;
}
```

### 3.3 工厂与 URL 兼容

```typescript
// lib/storage/provider.ts
export function getStorageProvider(): StorageProvider {
  const p = process.env.STORAGE_PROVIDER ?? 'supabase';
  switch (p) {
    case 'tencent-cos':    return new TencentCosAdapter();
    case 'volcengine-tos': throw new Error('volcengine-tos not implemented');
    case 'supabase':
    default:               return new SupabaseAdapter();
  }
}

// lib/storage/url.ts —— 老链接读取兼容
export function identifyStorageBackend(url: string): 'supabase' | 'tencent-cos' | 'external' {
  if (url.includes('.supabase.co/storage/')) return 'supabase';
  if (url.includes('.myqcloud.com') || url.includes(process.env.TENCENT_COS_CUSTOM_DOMAIN ?? '')) {
    return 'tencent-cos';
  }
  return 'external';
}
```

### 3.4 路径方案

```
{user_id}/{kind}/{yyyy}/{mm}/{dd}/{nanoid(12)}.{ext}
```

- 不可猜（含 nanoid）✓
- 按 user 隔离 ✓
- 按日期分桶，便于运维和成本归因 ✓
- `kind` ∈ `images | videos | audios | snapshots | frames | sprites | covers`

例：`550e8400-e29b-41d4/videos/2026/05/12/aB3xK9pL2mN7.mp4`

### 3.5 访问控制

- COS bucket 设为 **public-read**
- 路径不可猜（nanoid 12 字符 ≈ 71 bit 熵）
- HTML snapshot 中嵌入的图片 URL **永久有效**
- 老 Supabase URL 继续生效，由 `identifyStorageBackend` 在读路径自动识别

### 3.6 全量替换现有调用点

| 文件 | 现有调用 | 改为 |
|---|---|---|
| `components/dashboard/dashboard-content.tsx` | `supabase.storage.from('user-files').upload(...)` | `getStorageProvider().upload(...)` |
| `components/reader/EditMetaDialog.tsx` | 同上 | 同上 |
| `lib/ai-snapshot/*.ts` | 直接拼 Supabase URL | 通过 provider 获得 URL |
| 后续视频流水线写入 | （新增） | `getStorageProvider().upload(...)` 或 `createUploadCredential` |

读取路径不需要改：DB 中已有的 URL 直接渲染即可（`identifyStorageBackend` 只用于需要分支处理的场景）。

---

## 4. 子项目 B：视频抓取流水线

### 4.1 浏览器插件视频提取层

```
extension/src/content/
├── extractor.ts                  （现有，图文）
└── video-extractors/             （新增）
    ├── index.ts                  # 注册表 + matches() 自动派发
    ├── base.ts                   # IVideoExtractor 接口
    ├── douyin.ts                 # mp4 直链 → A 路径
    ├── kuaishou.ts               # mp4 直链 → A 路径
    ├── weibo.ts                  # mp4 直链 → A 路径
    ├── bilibili.ts               # m3u8 + 防盗链 → B 路径
    └── weixin-channel.ts         # 防盗链最严 → B 路径
```

### 4.2 提取器接口

```typescript
// extension/src/content/video-extractors/base.ts
export interface IVideoExtractor {
  platform: 'douyin' | 'bilibili' | 'weibo' | 'kuaishou' | 'weixin-channel';
  matches(url: string, document: Document): boolean;
  extract(): Promise<VideoCapture>;
}

export interface VideoCapture {
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
}
```

### 4.3 popup 交互

popup 检测到当前 tab 域名匹配 5 个平台之一 → 显示"保存视频"按钮。点击后：

- `recommendedStrategy === 'server'`：直接 POST `/api/extension/save-video`，1 秒内返回 noteId，popup 显示"已加入笔记库"后关闭。
- `recommendedStrategy === 'browser'`：先 POST `/api/extension/video-upload-cred` 拿到 COS 签名凭证 → 任务交给 background service worker（chrome.alarms 心跳 keepalive）→ 流式 fetch 视频字节 + 分片 PUT 到 COS → 完成后 POST `/api/extension/video-upload-done`。popup 立即关闭。

**用户感知**：5 个平台体验完全一致——点保存 → 1 秒内笔记卡片出现在笔记库（占位状态）→ 后台流水线推进 → 状态条逐步变绿 → 视频就绪后可点击播放。

### 4.4 服务端 API 路由

```
app/api/extension/
├── save/route.ts                 （现有，图文）
├── save-video/route.ts           （新）A 路径入口
├── video-upload-cred/route.ts    （新）B 路径申请凭证
└── video-upload-done/route.ts    （新）B 路径上传完毕汇报

app/api/ai/video/
├── ask/route.ts                  （新）交互式 Q&A
├── [jobId]/status/route.ts       （新）笔记卡片状态轮询
└── [jobId]/retry/route.ts        （新）用户主动重试
```

### 4.5 数据模型

#### `video_jobs` 表（新建，migration 023）

```sql
CREATE TABLE video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,

  -- 源信息
  source_url text NOT NULL,
  platform text NOT NULL,                   -- douyin | bilibili | weibo | kuaishou | weixin-channel | direct
  source_video_url text NOT NULL,
  request_headers jsonb,
  download_strategy text NOT NULL,          -- 'server' | 'browser'

  -- 各步状态
  download_status text NOT NULL DEFAULT 'pending',
  cos_key text,
  cos_url text,
  size_bytes bigint,
  download_error text,

  probe_status text NOT NULL DEFAULT 'pending',
  probe_data jsonb,

  cover_status text NOT NULL DEFAULT 'pending',
  cover_url text,

  frame_status text NOT NULL DEFAULT 'pending',
  frames jsonb,

  audio_status text NOT NULL DEFAULT 'pending',
  audio_task_id text,
  audio_result jsonb,
  audio_error text,

  visual_status text NOT NULL DEFAULT 'pending',
  visual_result jsonb,
  visual_error text,

  retry_count int NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_jobs_active ON video_jobs (updated_at)
  WHERE download_status IN ('pending', 'in_progress')
     OR audio_status    IN ('pending', 'in_progress')
     OR visual_status   IN ('pending', 'in_progress');

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
-- RLS: user_id = auth.uid()
```

#### `notes` 表扩展

新增 3 个字段：

```sql
ALTER TABLE notes ADD COLUMN video_job_id uuid REFERENCES video_jobs(id);
ALTER TABLE notes ADD COLUMN video_ready_at timestamptz;
ALTER TABLE notes ADD COLUMN video_overall_status text;
  -- 'processing' | 'media_ready' | 'fully_ready' | 'failed'
```

由 worker 在状态推进时同步维护。

#### 配额自然继承

`video_jobs.note_id` 反向关联 `notes`，视频笔记本身就是 `notes` 的一条记录（`content_type='video'`）。**所有按 notes 计数的配额规则自动覆盖视频笔记**。

**未来扩展点**（本期不实现）：如需"按存储大小"的配额（例 "免费用户 1GB 视频存储"），`video_jobs.size_bytes` 是天然的入口字段，按 user_id 聚合即可。

### 4.6 后台 Worker（Next.js 同进程）

#### 目录结构

```
lib/workers/video-pipeline/
├── scheduler.ts                  # setInterval(10s) 扫表
├── step-download.ts              # A 路径下载（B 路径由插件完成）
├── step-probe-and-cover.ts       # COS CI 探测 + 智能封面
├── step-extract-frames.ts        # COS CI 关键帧抽取
├── step-analyze-audio.ts         # 听悟提交 + 轮询
├── step-analyze-visual.ts        # Qwen-VL 调用
├── recovery.ts                   # 启动时扫 in_progress 续跑
└── reconcile.ts                  # 汇总 notes.video_overall_status
```

#### 状态机推进顺序

```
download_status ──done──┐
                        ▼
                 probe_status ──done──┐
                                      ▼
                  ┌─ cover_status ──┐
                  │                 ▼
                  ├─ frame_status ── done ──┐
                  │                         ▼
                  │              visual_status (Qwen-VL，可与音频并行)
                  │
                  └─ audio_status (听悟，与画面并行)
```

下载完成后，封面/帧抽取/音频分析/视觉分析的依赖关系：
- 音频分析仅需 `cos_url`，下载完即可启动
- 视觉分析需要先抽帧
- 抽帧策略有两种取舍（见 6.1 步骤 6 详述）：
  - **(默认) 等章节出来再按章节抽帧**：质量更优，但视觉线必须串在音频线后面，**不能与音频并行**
  - **(降级) 下载完立即按等间隔抽帧（每 60 秒一帧）**：视觉线可与音频并行，但帧选择是"机械的"，效果略差
- 当前 spec 选默认策略。封面 / 智能封面 可与音频独立并行

#### Worker 启动与生命周期

- 在 `instrumentation.ts` 或类似入口注册：检查 `VIDEO_WORKER_ENABLED=true` 后启动
- `recovery.ts` 在启动时执行一次：扫描所有非终态 jobs，根据现有字段决定续跑/重置
- `scheduler.ts` 每 10 秒扫一次，对每个非终态 job 调用对应 step（按状态机选）
- 每个 step 是 async 函数，幂等

#### 幂等模板

```typescript
async function stepX(job: VideoJob) {
  if (job.x_status === 'done') return;
  if (job.x_status === 'in_progress') {
    if (isStale(job.updated_at, 30 * 60_000)) {
      await markPending(job, 'x');
    } else {
      return;
    }
  }
  await markInProgress(job, 'x');
  try {
    const result = await actuallyDoX(job);
    await persistResult(job, 'x', result);
    await markDone(job, 'x');
  } catch (err) {
    await markFailed(job, 'x', err);
  }
}
```

---

## 5. AI 分析层

### 5.1 抽象目录

```
lib/ai-analysis/
├── types.ts                       # AudioAnalysisResult / VisualAnalysisResult
├── audio-provider.ts              # 工厂（当前仅返回 Tingwu adapter）
├── visual-provider.ts             # 工厂（当前仅返回 Qwen-VL adapter）
├── adapters/
│   ├── tingwu.ts                  # 阿里通义听悟（唯一音频/文本分析提供者）
│   └── qwen-vl.ts                 # 通义千问 VL（视觉）
└── qa-service.ts                  # 交互式 Q&A
```

### 5.2 AudioAnalysisProvider 接口

```typescript
export interface AudioAnalysisProvider {
  readonly name: 'tingwu';

  submit(input: {
    mediaUrl: string;
    capabilities: Array<'transcript' | 'chapters' | 'summary' | 'key_points' | 'qa'>;
    language?: 'zh' | 'en' | 'auto';
  }): Promise<{ taskId: string }>;

  poll(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'done' | 'failed';
    progress?: number;
    result?: AudioAnalysisResult;
    error?: { code: string; message: string };
  }>;
}

export interface AudioAnalysisResult {
  transcript: Array<{ start: number; end: number; text: string; speaker?: string }>;
  chapters: Array<{ start: number; end: number; title: string; summary?: string }>;
  summary: string;
  keyPoints: string[];
  qaPairs: Array<{ q: string; a: string; anchorTime?: number }>;
  speakers?: Array<{ id: string; label: string }>;
}
```

**Note**: 接口形态为多 provider 设计，但首发只有 Tingwu adapter。这是为未来换 provider 留的"工程保险"，成本只是多写一层薄包装。

### 5.3 Tingwu Adapter 要点

- 用阿里云 OpenAPI SDK 走 RPC（POP），创建 `Tingwu.Task` 提交音视频 URL（COS 公开链接）+ 能力开关
- 轮询拿结果 → 映射到 `AudioAnalysisResult`
- 听悟若返回"该能力未在控制台开通"，写 warning，**不阻塞其他能力**

### 5.4 VisualAnalysisProvider 接口

```typescript
export interface VisualAnalysisProvider {
  readonly name: 'qwen-vl';

  analyzeFrames(input: {
    frames: Array<{ timestamp: number; url: string }>;
    context?: string;          // 标题、章节标题，做语义辅助
  }): Promise<Array<{
    timestamp: number;
    sceneDescription: string;
    entities: string[];
    onScreenText?: string;
  }>>;
}
```

实现：
- 输入：来自 COS CI 抽帧得到的关键帧（按章节切，每章节 1 帧，最多 20 帧）
- 调 DashScope `qwen-vl-max`，**支持图片 URL 直接传，不用本地下载**
- 失败容忍：视觉失败不阻塞 `audio_status=done` 进入 `media_ready`

### 5.5 交互式 Q&A 服务

```
POST /api/ai/video/ask
body: { noteId, question, history? }
```

实现：
1. 从 `video_jobs.audio_result.transcript` 取完整字幕
2. 拼 prompt：系统指令 + 字幕 + history + question
3. 调通义千问 chat completion（`qwen-plus` 或 `qwen-max`）
4. 返回 `{ answer }`，不带时间戳跳转

**优化**：transcript token 超 30k 时，先用 Qwen 抽段落摘要再拼 prompt。

---

## 6. 端到端数据流

### 6.1 A 路径（抖音 / 快手 / 微博，服务端下载）

```
1. 用户在抖音页面点插件保存
2. content/video-extractors/douyin.ts 提取 {videoUrl, headers, meta}
3. POST /api/extension/save-video
   ├─ 验证 user (Supabase auth cookie)
   ├─ 创建 notes 记录 (content_type='video', video_overall_status='processing')
   ├─ 创建 video_jobs 记录 (download_strategy='server')
   └─ 返回 {noteId, jobId}  ← popup 立即关闭

后台 worker（10 秒扫一次）：

4. step-download.ts
   ├─ download_status = 'in_progress'
   ├─ axios stream + request_headers 拉视频
   ├─ getStorageProvider().upload({key, body, contentType})
   ├─ 更新 cos_key / cos_url / size_bytes / notes.media_url
   └─ download_status = 'done'

5. step-probe-and-cover.ts
   ├─ COS CI GetMediaInfo → duration/width/height
   ├─ COS CI 智能封面 → cover_url
   ├─ 更新 notes.media_duration
   └─ probe_status / cover_status = 'done'

6. 并行：
   ├─ step-extract-frames.ts → 按章节抽帧（章节信息来自步骤 7 完成后）
   │     └─ step-analyze-visual.ts → Qwen-VL → visual_result
   └─ step-analyze-audio.ts
         ├─ tingwu.submit(cos_url, capabilities)
         ├─ audio_task_id 持久化，audio_status='in_progress'
         ├─ 下次扫到 in_progress → tingwu.poll
         ├─ done → 持久化 audio_result
         └─ audio_status = 'done'

7. reconcile.ts
   ├─ download=done AND audio=done AND visual ∈ {done, failed, skipped}
   ├─ notes.video_overall_status = 'fully_ready'
   ├─ notes.video_ready_at = now()
   └─ 笔记卡片轮询 200，前端切换 UI
```

**注**：步骤 6 抽帧的"按章节切"依赖步骤 6.audio 先完成章节识别。如果想更早出画面 tab，可降级为"按等间隔抽帧"（每 60 秒一帧）。本期默认走"等章节再抽"，避免重抽。

### 6.2 B 路径（B 站 / 视频号，浏览器下载）

```
1. 用户点保存
2. content/video-extractors/bilibili.ts → recommendedStrategy='browser'
3. POST /api/extension/video-upload-cred {ext, sizeHint, meta}
   ├─ 创建 notes 占位 + video_jobs (download_strategy='browser', download_status='in_progress')
   ├─ 生成 cos_key + StorageProvider.createUploadCredential()
   └─ 返回 {jobId, noteId, uploadUrl, headers, publicUrl}
4. popup 关闭，控制权交给 background service worker
5. service-worker.ts:
   ├─ chrome.alarms 注册心跳，避免 idle 收割
   ├─ fetch(videoUrl) 流式拉视频（带浏览器自带 session/cookie）
   ├─ 分片 PUT 到 uploadUrl
   └─ 完成 → POST /api/extension/video-upload-done {jobId, cos_key, size}
6. /api/extension/video-upload-done
   ├─ StorageProvider.exists(cos_key) 验证
   ├─ 写 download_status='done', cos_url=publicUrl, size_bytes
   └─ 入 worker 队列推进后续步骤
7. 之后流程同 A 路径步骤 5+
```

---

## 7. 错误处理与重试

### 7.1 失败分类

| 类型 | 例子 | 处理 |
|---|---|---|
| **可重试瞬时** | 5xx、timeout、网络抖动 | 指数退避，最多 3 次：`next_retry_at = now() + 2^retry_count 分钟` |
| **可重试需介入** | COS 凭证过期、听悟配额不足 | 标 failed，错误码 `REQUIRES_ATTENTION`，前端"重试"按钮 + 提示 |
| **永久失败** | 404、视频已删、不支持的格式 | 标 failed，错误码 `PERMANENT`，前端"重试"按钮置灰 + 显示原因 |
| **A 路径 IDC IP 被拦** | 抖音/快手 CDN 拒绝服务端 IP | 自动降级 B 路径：标 `download_status='need_browser_fallback'`，通知插件改走 B；插件离线则等下次保存时 retry |

### 7.2 部分失败的容忍

| 步骤 | 失败是否阻塞 fully_ready | UI 表现 |
|---|---|---|
| download | **阻塞** | "视频获取失败，点击重试" |
| probe + cover | 不阻塞 | 用占位封面 |
| frame_extraction | 不阻塞 | 画面 tab 显示空状态 |
| audio (听悟) | **阻塞**，只重试不切换 | 状态显示"AI 分析重试中"，超 3 次后"分析失败，点击重试" |
| visual (Qwen-VL) | 不阻塞 | 画面 tab 显示"画面理解暂不可用" |

### 7.3 用户可见的重试入口

- **笔记卡片 → 失败状态** → 调 `POST /api/ai/video/[jobId]/retry`，把对应 step 的 status 改回 pending
- **设置中心 → 失败任务列表**（可选，下一迭代）：批量重试

### 7.4 防止 worker 雪崩

- 每个 step 加并发上限（如 `MAX_CONCURRENT_DOWNLOADS=3`），避免下载占满带宽
- 每个 step 加单次超时（如 download 默认 10 分钟）
- `next_retry_at` 配合 SQL 查询避免热重试

---

## 8. 视频 Reader UX（复用现有 3 栏布局）

### 8.1 左栏：`LeftSidebar/VideoChapters.tsx`（增强）

- 直接读 `video_jobs.audio_result.chapters` 自动渲染
- 每个章节带：起止时间、标题、(可选) 关键帧缩略图（取离章节中点最近的那帧）
- 点击章节 → 触发 `video:seek` 事件，VideoPlayer 跳转

### 8.2 右栏：Tabs 化

现有 `RightSidebar` 改成 Radix Tabs 容器：

```
[ 转写 ] [ Q&A ] [ 画面 ] [ 批注 ]
```

| Tab | 内容 |
|---|---|
| **转写** | 增强现有 `TranscriptView.tsx`：说话人头像/标签 + 同步高亮当前播放段落 |
| **Q&A**（新 `QAPanel.tsx`）| 顶部：听悟预生成 Q&A 列表（可折叠）<br>下方：chat 输入 + 历史，调用 `/api/ai/video/ask` |
| **画面**（新 `VisualFrames.tsx`）| 缩略图网格 + 时间戳 + 场景描述 + 实体 chips；点击 → 跳转播放时间 |
| **批注** | 现有 `AnnotationList.tsx` 不动 |

### 8.3 笔记卡片状态指示

`components/dashboard/dashboard-content.tsx` 视频卡片：

- 读 `notes.video_overall_status`
- 状态标签：
  - `processing` → "视频处理中" + 旋转图标
  - `media_ready` → "AI 分析中"
  - `fully_ready` → 隐藏，正常显示
  - `failed` → "处理失败，点击重试"
  - `need_browser_fallback`（A 路径被 CDN 拦截、等待插件重做）→ "请打开插件重试"——区别于普通 failed，用户需要回到源站让插件重新发起 B 路径下载
- 每 10 秒轮询 `/api/ai/video/[jobId]/status` 直到 `fully_ready`

---

## 9. 测试策略

### 9.1 单元测试

| 模块 | 关键测试点 |
|---|---|
| `lib/storage/url.ts:identifyStorageBackend` | Supabase / COS / 外链 / 边界（空、null、混合路径） |
| `lib/storage/adapters/tencent-cos.ts` | upload 路径生成、createUploadCredential 签名格式（mock COS SDK） |
| `lib/ai-analysis/adapters/tingwu.ts` | submit/poll 状态映射、错误解析（mock OpenAPI 响应） |
| `lib/workers/video-pipeline/step-*.ts` | 幂等（重复跑同一 job 不重复上传/扣费）、状态推进、失败重试 |
| `extension/src/content/video-extractors/*.ts` | 每平台一份 DOM fixture，确保 extract() 输出正确 VideoCapture |

### 9.2 集成测试

| 场景 | 验证 |
|---|---|
| A 路径全链路（mp4 直链 → COS → 听悟 mock → ready）| video_jobs 所有状态正确流转，notes.video_overall_status='fully_ready' |
| B 路径全链路（本地小视频模拟 PUT → done）| upload-cred + upload-done 两个 endpoint 配合正确 |
| 启动恢复 | 故意把任务标 in_progress 然后重启进程，确认 recovery.ts 续跑 |
| 老 Supabase URL 兼容 | 笔记里夹一条老 supabase.co URL，详情页正常显示 |
| 听悟失败重试 | mock 听悟前 2 次返 5xx，第 3 次成功；验证最终 done |

### 9.3 端到端手动验收清单（dev 账号，避免触平台风控）

- 抖音短视频 → 完整笔记 + 章节 + 转写 + Q&A
- 快手短视频 → 同上
- 微博视频 → 同上
- B 站 m3u8（5 分钟以内）→ 浏览器下载 → 同上
- 视频号短视频 → 浏览器下载 → 同上
- 直链 mp4（用户手贴 URL）→ 服务端下载 → 同上

### 9.4 性能与成本观测埋点

- 视频处理总耗时 P50 / P95（基于 `video_jobs` 时间戳字段）
- 听悟分钟数月用量（告警阈值，避免账单意外）
- COS 流量 / 存储用量（按 user_id 聚合）
- Qwen-VL 调用次数与 token 消耗

---

## 10. 环境变量（占位符，无密钥值）

```bash
# === 存储 ===
STORAGE_PROVIDER=tencent-cos                  # supabase | tencent-cos | volcengine-tos
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_REGION=ap-shanghai
TENCENT_COS_BUCKET=
TENCENT_COS_CUSTOM_DOMAIN=                    # 可选 CDN
# Supabase（仅 legacy 读 + 鉴权）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=user-files

# === AI 分析 ===
AUDIO_ANALYSIS_PROVIDER=tingwu
VISUAL_ANALYSIS_PROVIDER=qwen-vl              # qwen-vl | none

# 阿里通义听悟
ALI_TINGWU_APPKEY=
ALIBABA_CLOUD_ACCESS_KEY_ID=
ALIBABA_CLOUD_ACCESS_KEY_SECRET=
ALIBABA_CLOUD_REGION=cn-beijing

# DashScope（通义千问 / Qwen-VL）
DASHSCOPE_API_KEY=
DASHSCOPE_TEXT_MODEL=qwen-plus
DASHSCOPE_VISION_MODEL=qwen-vl-max

# === Worker 调度 ===
VIDEO_WORKER_ENABLED=true
VIDEO_WORKER_INTERVAL_MS=10000
VIDEO_WORKER_MAX_RETRIES=3
MAX_CONCURRENT_DOWNLOADS=3
DOWNLOAD_TIMEOUT_MS=600000
```

⚠️ 真实密钥仅放 `.env.local`，**永不提交 git**。`.env.example` 只放变量名 + 注释。

---

## 11. 实施顺序

```
A. 多云存储抽象层
  │
  ├─ A1. 接口 + Supabase 适配器（包路径迁移，全量替换调用点）
  ├─ A2. Tencent COS 适配器（基础 upload/exists/delete）
  ├─ A3. URL 兼容（identifyStorageBackend）
  ├─ A4. Tencent COS 数据万象 CI 能力封装（probe/cover/frames/sprites）
  └─ A5. 集成测试 + 回归（确认现有图文转存路径不受影响）
       ↓
B. 视频抓取 + AI
  │
  ├─ B1. video_jobs 表 + notes 字段扩展（migration 023）
  ├─ B2. AIAnalysisProvider 接口 + Tingwu adapter + Qwen-VL adapter
  ├─ B3. 后台 worker 框架（scheduler / recovery / 幂等模板）
  ├─ B4. step-download + step-probe + step-cover（A 路径核心）
  ├─ B5. step-analyze-audio（听悟提交/轮询）
  ├─ B6. step-extract-frames + step-analyze-visual（视觉线）
  ├─ B7. 新 API 路由（save-video / upload-cred / upload-done / ask / status / retry）
  ├─ B8. 插件 video-extractors（5 平台 × 1 个 adapter）
  ├─ B9. 插件 service-worker 后台下载逻辑（B 路径）
  ├─ B10. Reader 右栏 Tabs 改造（转写增强 / Q&A / 画面）
  ├─ B11. Reader 左栏 VideoChapters 增强（自动章节 + 缩略图）
  └─ B12. 笔记卡片状态指示 + 轮询
```

每个里程碑后跑回归，确保图文转存路径完全不受影响。

---

## 12. Open Question

仅 1 个真 Open Question（开发第一周用 1-2 小时 spike 即可确认）：

**Q1：听悟"高阶 Q&A"能力在阿里云 OpenAPI 中是否真有调用接口？**

- 听悟 Console 内可能可见的"智能问答 / 思维导图"能力，**未必都在 OpenAPI 公开**
- 如果可用 → 直接调，省事
- 如果不可用 → 降级为"我们自己用通义千问基于 transcript 做 Q&A"。这并不影响功能完整性，只是少用了一层封装，对架构无影响

**验证方式**：在 `lib/ai-analysis/adapters/tingwu.ts` 实现前先跑 spike，调一次实际 API 看返回字段。

---

## 13. 关键设计决策汇总

| 维度 | 决策 | 理由 |
|---|---|---|
| 子项目分解 | A 存储抽象 → B 视频，A 是 B 前置 | 隔离、独立验证、彼此不阻塞 |
| 存储后端 | 腾讯 COS 一家 + 数据万象 CI；Supabase 仅 legacy 读 | 国内访问最快、ASR/视频处理生态融合 |
| 存储抽象 | StorageProvider 接口 + env 切换 | 业务代码与厂商解耦 |
| 文件访问 | Public-read + 不可猜路径 | HTML snapshot 永久有效，零运维 |
| 视频来源 | 浏览器插件 5 平台 + 直链；服务端不解析平台页 | 用户已登录绕反爬、合规、零 yt-dlp 运维 |
| 下载路径 | A 服务端 / B 浏览器，混合 fallback | 5 平台覆盖率最稳 |
| 用户体验 | 异步队列，popup 1 秒返回 | A/B 路径用户无感差异 |
| AI 分析层 | AIAnalysisProvider 接口，仅 Tingwu adapter | 抽象成本低，未来换 provider 不动业务 |
| 音频/文本分析 | 阿里通义听悟一家（ASR + 章节 + 摘要 + Q&A） | 链路单一、调试简单 |
| 视觉分析 | Qwen-VL，独立步骤，失败不阻塞 | 容忍设计，不堵 fully_ready |
| Reader UX | 复用 3 栏布局，右栏 Tabs | 不引入新视图，工程量最小 |
| Q&A | 交互式（B2），暂不带时间戳跳转 | 平衡复杂度与价值 |
| 知识库 | 暂不集成 | 知识库技术方案明确后另立项 |
| 运行时 | Next.js 同进程后台 worker，纯轮询 | 部署在 CVM，无 Serverless 限制，无 webhook 依赖 |
| 部署 | 腾讯云 CVM（生产）+ 本地（开发） | 已确认 |

---

## 14. OpenSpec 落地建议

本 spec 拆为两个 OpenSpec change 实施：

1. **`add-multi-cloud-storage-abstraction`**（先做）
   - 替代/合并已有的 `enhance-video-capture-storage` 的"存储"部分
   - Affected specs: 新建 `storage` capability
2. **`add-video-capture-and-analysis`**（后做，依赖 1）
   - 替代已有的 `enhance-video-capture-storage` 的"视频"部分
   - Affected specs: `capture` (扩展)、新建 `video-analysis` capability

已有的 `openspec/changes/enhance-video-capture-storage/` 应在两份新 change 落地后归档（archive）。
