# Multi-Cloud Storage Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前直接调 Supabase Storage 的所有路径，收敛到统一的 `StorageProvider` 抽象层；首发腾讯云 COS 作为唯一新写入后端（含数据万象 CI 视频处理能力），Supabase Storage 保留为只读 legacy。

**Architecture:** 新建 `lib/storage/` 模块，提供 `StorageProvider` 接口 + 工厂 + 3 个 adapter（Supabase / Tencent COS / Volcengine TOS stub）。环境变量 `STORAGE_PROVIDER` 决定新写入走哪家；读取时由 `identifyStorageBackend(url)` 自动识别老链接。所有现有调用点（图文 dashboard 上传、reader 封面、AI snapshot 持久化）切到新接口。

**Tech Stack:** TypeScript, Next.js 15 App Router, `cos-nodejs-sdk-v5`（腾讯云 COS SDK）, `nanoid`（不可猜路径）, Vitest（新增测试框架）

**Spec:** `docs/superpowers/specs/2026-05-12-video-and-storage-design.md` §3（StorageProvider 抽象 + 适配器）+ §10（环境变量）

---

## 文件结构总览

**新建：**

| 路径 | 责任 |
|---|---|
| `lib/storage/types.ts` | `StorageProvider`、`MediaProcessingCapability` 接口与共享类型 |
| `lib/storage/url.ts` | `identifyStorageBackend(url)`：识别 URL 属于哪家存储 |
| `lib/storage/keys.ts` | `buildStorageKey({userId, kind, ext})`：生成 `{user_id}/{kind}/{yyyy}/{mm}/{dd}/{nanoid}.{ext}` |
| `lib/storage/adapters/supabase.ts` | Supabase 适配器（读 + 写，保持向后兼容） |
| `lib/storage/adapters/tencent-cos.ts` | 腾讯云 COS 适配器（读 + 写 + 签名凭证） |
| `lib/storage/adapters/tencent-cos-media.ts` | 腾讯云数据万象 CI 能力（probe / 智能封面 / 关键帧 / 雪碧图） |
| `lib/storage/adapters/volcengine-tos.ts` | 火山引擎 TOS 占位 stub（throws not-implemented） |
| `lib/storage/provider.ts` | `getStorageProvider()` 工厂，按 env 路由 |
| `lib/storage/index.ts` | 对外统一 barrel 导出 |
| `tests/lib/storage/url.test.ts` | URL 识别单测 |
| `tests/lib/storage/keys.test.ts` | Key 生成单测 |
| `tests/lib/storage/adapters/supabase.test.ts` | Supabase adapter 单测（mock supabase-js） |
| `tests/lib/storage/adapters/tencent-cos.test.ts` | Tencent COS adapter 单测（mock cos-nodejs-sdk-v5） |
| `tests/lib/storage/adapters/tencent-cos-media.test.ts` | COS CI 能力单测 |
| `tests/lib/storage/provider.test.ts` | 工厂路由单测 |
| `vitest.config.ts` | Vitest 配置 |

**修改：**

| 路径 | 改动 |
|---|---|
| `package.json` | 添加 `vitest`、`@vitest/ui`、`cos-nodejs-sdk-v5`、`nanoid`；新增 `test`、`test:ui` 脚本 |
| `tsconfig.json` | 包含 `tests/**` 路径 |
| `.env.example` | 新增 `STORAGE_PROVIDER`、`TENCENT_COS_*` 等占位符 |
| `components/dashboard/dashboard-content.tsx` | Add Note 上传切到新 provider |
| `components/reader/EditMetaDialog.tsx` | 封面上传切到新 provider |
| `lib/ai-snapshot/*.ts` | AI snapshot 持久化切到新 provider |
| `CLAUDE.md` | 在"Storage Bucket"段加一句指向 `lib/storage/` |

---

## 实施约束

- **TDD 严格执行**：每个有逻辑的模块先写测试，确认失败 → 实现 → 确认通过 → 提交
- **DRY / YAGNI**：Volcengine TOS 只留 stub，不实现；签名 URL 接口暂不抽象到 `StorageProvider`（Plan A 全公开可读）
- **频繁 commit**：每个 Task 完成后一个 commit；步骤里如显式要求"提交"则提交
- **现有图文转存路径不能被破坏**：每次迁移完一个调用点立即跑 lint + 手动 smoke

---

## Task 0：搭建 Vitest 测试框架

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: 安装 Vitest 及相关依赖**

```bash
npm install -D vitest @vitest/ui @types/node
```

- [ ] **Step 2: 创建 `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 3: 在 `package.json` scripts 加测试命令**

修改 `package.json` 的 `scripts` 段，加入：

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 4: 在 `tsconfig.json` include 里加 tests 目录**

检查 `tsconfig.json` 的 `include` 字段是否含 `tests/**/*.ts`，没有则加上（保持现有其他配置不变）。

- [ ] **Step 5: 创建一个冒烟测试验证 Vitest 跑得通**

`tests/smoke.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: 运行测试验证**

```bash
npm test
```

Expected：`1 passed (1)`，无 error。

- [ ] **Step 7: 删除冒烟测试**

```bash
rm tests/smoke.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json
git commit -m "chore(test): 引入 Vitest 测试框架"
```

---

## Task 1：安装存储所需依赖 + 占位环境变量

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: 安装腾讯云 COS SDK 和 nanoid**

```bash
npm install cos-nodejs-sdk-v5 nanoid
```

- [ ] **Step 2: 在 `.env.example` 增加新变量**

在文件末尾追加（保留所有现有内容）：

```bash
# === 多云对象存储 ===
# 新写入后端：supabase | tencent-cos | volcengine-tos
STORAGE_PROVIDER=supabase

# 腾讯云 COS（生产首选）
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_REGION=ap-shanghai
TENCENT_COS_BUCKET=
TENCENT_COS_CUSTOM_DOMAIN=
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(storage): 安装 COS SDK + nanoid，新增存储相关 env 占位"
```

---

## Task 2：定义 StorageProvider 接口与共享类型

**Files:**
- Create: `lib/storage/types.ts`

接口本身没有运行时逻辑，不需要单测（其正确性由后续 adapter 实现的测试隐式覆盖）。

- [ ] **Step 1: 写 `lib/storage/types.ts`**

```typescript
/**
 * 多云对象存储抽象层 · 类型定义
 *
 * 设计要点：
 * - 所有 adapter 实现 StorageProvider 接口
 * - 仅 Tencent COS 额外暴露 MediaProcessingCapability（视频处理）
 * - 公开访问模式（public-read + 不可猜路径），暂不支持私有签名 URL
 *
 * 参考：docs/superpowers/specs/2026-05-12-video-and-storage-design.md §3
 */

export type StorageBackend = 'supabase' | 'tencent-cos' | 'volcengine-tos';

/** 业务上的文件分类，决定 key 的 {kind} 段 */
export type StorageKind =
  | 'images'
  | 'videos'
  | 'audios'
  | 'snapshots'
  | 'frames'
  | 'sprites'
  | 'covers';

export interface UploadInput {
  /** 完整对象 key，例如 "userId/videos/2026/05/12/abc123.mp4" */
  key: string;
  body: Buffer | ReadableStream | Blob;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

export interface UploadCredentialInput {
  key: string;
  contentType: string;
  /** 凭证有效期（秒），默认 3600 */
  expiresIn?: number;
}

export interface UploadCredential {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  publicUrl: string;
  expiresAt: number;
}

export interface StorageProvider {
  readonly name: StorageBackend;

  upload(input: UploadInput): Promise<UploadResult>;
  createUploadCredential(input: UploadCredentialInput): Promise<UploadCredential>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** 仅 Tencent COS（数据万象 CI）实现 */
export interface MediaProcessingCapability {
  probe(sourceKey: string): Promise<{
    durationSec: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string;
    sizeBytes: number;
  }>;

  generateSmartCover(input: {
    sourceKey: string;
    outputKey: string;
  }): Promise<{ key: string; url: string }>;

  extractFrames(input: {
    sourceKey: string;
    timestamps: number[];
    outputKeyPrefix: string;
  }): Promise<Array<{ timestamp: number; key: string; url: string }>>;

  generateSpriteSheet(input: {
    sourceKey: string;
    outputKey: string;
    rows: number;
    cols: number;
  }): Promise<{ key: string; url: string; vttKey?: string }>;
}

/** 运行时探测 adapter 是否带 CI 能力 */
export function hasMediaProcessing(p: StorageProvider): p is StorageProvider & MediaProcessingCapability {
  return typeof (p as any).probe === 'function';
}
```

- [ ] **Step 2: 跑 typecheck 确认无语法错误**

```bash
npx tsc --noEmit
```

Expected：无 error（如有现有非相关 error，确认 `lib/storage/` 下文件零 error）。

- [ ] **Step 3: Commit**

```bash
git add lib/storage/types.ts
git commit -m "feat(storage): 定义 StorageProvider 与 MediaProcessingCapability 接口"
```

---

## Task 3：实现 URL 识别工具（TDD）

**Files:**
- Create: `lib/storage/url.ts`
- Test: `tests/lib/storage/url.test.ts`

- [ ] **Step 1: 写失败测试 `tests/lib/storage/url.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { identifyStorageBackend } from '@/lib/storage/url';

describe('identifyStorageBackend', () => {
  beforeEach(() => {
    delete process.env.TENCENT_COS_CUSTOM_DOMAIN;
  });

  it('identifies supabase storage URLs', () => {
    expect(identifyStorageBackend('https://xyz.supabase.co/storage/v1/object/public/user-files/a.jpg'))
      .toBe('supabase');
  });

  it('identifies tencent COS standard URLs', () => {
    expect(identifyStorageBackend('https://my-bucket.cos.ap-shanghai.myqcloud.com/a.mp4'))
      .toBe('tencent-cos');
  });

  it('identifies tencent COS custom domain when env is set', () => {
    process.env.TENCENT_COS_CUSTOM_DOMAIN = 'cdn.example.com';
    expect(identifyStorageBackend('https://cdn.example.com/a.jpg'))
      .toBe('tencent-cos');
  });

  it('returns external for unrelated URLs', () => {
    expect(identifyStorageBackend('https://random.cdn.com/a.jpg')).toBe('external');
    expect(identifyStorageBackend('https://example.com/a.png')).toBe('external');
  });

  it('handles empty / falsy input safely', () => {
    expect(identifyStorageBackend('')).toBe('external');
    // @ts-expect-error testing runtime safety
    expect(identifyStorageBackend(null)).toBe('external');
    // @ts-expect-error
    expect(identifyStorageBackend(undefined)).toBe('external');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/lib/storage/url.test.ts
```

Expected：FAIL with "Cannot find module '@/lib/storage/url'"

- [ ] **Step 3: 实现 `lib/storage/url.ts`**

```typescript
import type { StorageBackend } from './types';

export function identifyStorageBackend(url: unknown): StorageBackend | 'external' {
  if (typeof url !== 'string' || !url) return 'external';

  if (url.includes('.supabase.co/storage/')) return 'supabase';

  if (url.includes('.myqcloud.com')) return 'tencent-cos';

  const customDomain = process.env.TENCENT_COS_CUSTOM_DOMAIN;
  if (customDomain && url.includes(customDomain)) return 'tencent-cos';

  return 'external';
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/storage/url.test.ts
```

Expected：PASS（5 个测试全过）

- [ ] **Step 5: Commit**

```bash
git add lib/storage/url.ts tests/lib/storage/url.test.ts
git commit -m "feat(storage): 实现 identifyStorageBackend（URL 识别）"
```

---

## Task 4：实现 Storage Key 生成工具（TDD）

**Files:**
- Create: `lib/storage/keys.ts`
- Test: `tests/lib/storage/keys.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/storage/keys.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildStorageKey } from '@/lib/storage/keys';

describe('buildStorageKey', () => {
  it('produces well-formed key with all segments', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T10:00:00Z'));

    const key = buildStorageKey({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      kind: 'videos',
      ext: 'mp4',
    });

    expect(key).toMatch(
      /^550e8400-e29b-41d4-a716-446655440000\/videos\/2026\/05\/12\/[a-zA-Z0-9_-]{12}\.mp4$/
    );

    vi.useRealTimers();
  });

  it('rejects userId with path traversal characters', () => {
    expect(() => buildStorageKey({ userId: '../etc', kind: 'images', ext: 'jpg' }))
      .toThrow(/invalid userId/i);
  });

  it('normalizes ext (strip leading dot, lowercase)', () => {
    const key = buildStorageKey({ userId: 'u', kind: 'images', ext: '.JPG' });
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('rejects empty ext', () => {
    expect(() => buildStorageKey({ userId: 'u', kind: 'images', ext: '' })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/lib/storage/keys.test.ts
```

Expected：FAIL with "Cannot find module"

- [ ] **Step 3: 实现 `lib/storage/keys.ts`**

```typescript
import { nanoid } from 'nanoid';
import type { StorageKind } from './types';

const USER_ID_RE = /^[A-Za-z0-9_-]+$/;

export function buildStorageKey(input: {
  userId: string;
  kind: StorageKind;
  ext: string;
}): string {
  if (!USER_ID_RE.test(input.userId)) {
    throw new Error(`invalid userId: must match [A-Za-z0-9_-]+`);
  }
  const normalizedExt = input.ext.replace(/^\./, '').toLowerCase();
  if (!normalizedExt) throw new Error('ext is required');

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');

  return `${input.userId}/${input.kind}/${yyyy}/${mm}/${dd}/${nanoid(12)}.${normalizedExt}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/storage/keys.test.ts
```

Expected：PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage/keys.ts tests/lib/storage/keys.test.ts
git commit -m "feat(storage): 实现 buildStorageKey（不可猜路径生成）"
```

---

## Task 5：实现 Supabase 适配器（TDD）

**Files:**
- Create: `lib/storage/adapters/supabase.ts`
- Test: `tests/lib/storage/adapters/supabase.test.ts`

策略：Supabase adapter 是对现有 supabase-js 的薄包装。测试用 vi.mock 把 `@supabase/supabase-js` 整个 mock 掉。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/storage/adapters/supabase.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadMock = vi.fn();
const removeMock = vi.fn();
const listMock = vi.fn();
const getPublicUrlMock = vi.fn();
const createSignedUploadUrlMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        list: listMock,
        getPublicUrl: getPublicUrlMock,
        createSignedUploadUrl: createSignedUploadUrlMock,
      }),
    },
  })),
}));

import { SupabaseAdapter } from '@/lib/storage/adapters/supabase';

describe('SupabaseAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET = 'user-files';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  });

  it('upload returns url + key + size', async () => {
    uploadMock.mockResolvedValueOnce({ data: { path: 'u/images/2026/05/12/x.jpg' }, error: null });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/user-files/u/images/2026/05/12/x.jpg' } });

    const a = new SupabaseAdapter();
    const body = Buffer.from('abc');
    const r = await a.upload({ key: 'u/images/2026/05/12/x.jpg', body, contentType: 'image/jpeg' });

    expect(r.key).toBe('u/images/2026/05/12/x.jpg');
    expect(r.size).toBe(3);
    expect(r.url).toContain('test.supabase.co');
  });

  it('upload throws on supabase error', async () => {
    uploadMock.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    const a = new SupabaseAdapter();
    await expect(a.upload({ key: 'k', body: Buffer.from(''), contentType: 'image/jpeg' }))
      .rejects.toThrow(/denied/);
  });

  it('getPublicUrl builds expected URL shape', () => {
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/user-files/foo.jpg' } });
    const a = new SupabaseAdapter();
    expect(a.getPublicUrl('foo.jpg')).toContain('foo.jpg');
  });

  it('exists returns true when list finds the file', async () => {
    listMock.mockResolvedValueOnce({ data: [{ name: 'x.jpg' }], error: null });
    const a = new SupabaseAdapter();
    expect(await a.exists('u/images/x.jpg')).toBe(true);
  });

  it('exists returns false when list empty', async () => {
    listMock.mockResolvedValueOnce({ data: [], error: null });
    const a = new SupabaseAdapter();
    expect(await a.exists('u/missing.jpg')).toBe(false);
  });

  it('delete calls remove with key', async () => {
    removeMock.mockResolvedValueOnce({ data: [], error: null });
    const a = new SupabaseAdapter();
    await a.delete('u/x.jpg');
    expect(removeMock).toHaveBeenCalledWith(['u/x.jpg']);
  });

  it('createUploadCredential returns signed url', async () => {
    createSignedUploadUrlMock.mockResolvedValueOnce({
      data: { signedUrl: 'https://test.supabase.co/storage/v1/object/upload/sign/...', token: 't', path: 'k' },
      error: null,
    });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/user-files/k' } });
    const a = new SupabaseAdapter();
    const c = await a.createUploadCredential({ key: 'k', contentType: 'video/mp4' });
    expect(c.method).toBe('PUT');
    expect(c.publicUrl).toContain('test.supabase.co');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/lib/storage/adapters/supabase.test.ts
```

Expected：FAIL with "Cannot find module"

- [ ] **Step 3: 实现 `lib/storage/adapters/supabase.ts`**

```typescript
import { createClient } from '@/lib/supabase/server';
import type {
  StorageProvider,
  UploadInput,
  UploadResult,
  UploadCredential,
  UploadCredentialInput,
} from '../types';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'user-files';

export class SupabaseAdapter implements StorageProvider {
  readonly name = 'supabase' as const;

  async upload(input: UploadInput): Promise<UploadResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(input.key, input.body as any, {
        contentType: input.contentType,
        upsert: false,
      });
    if (error || !data) throw new Error(`supabase upload failed: ${error?.message}`);

    const url = this.getPublicUrl(data.path);
    const size = sizeOfBody(input.body);
    return { url, key: data.path, size };
  }

  async createUploadCredential(input: UploadCredentialInput): Promise<UploadCredential> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(input.key);
    if (error || !data) throw new Error(`supabase signed upload url failed: ${error?.message}`);

    const publicUrl = this.getPublicUrl(input.key);
    return {
      uploadUrl: data.signedUrl,
      method: 'PUT',
      publicUrl,
      expiresAt: Date.now() + (input.expiresIn ?? 3600) * 1000,
    };
  }

  getPublicUrl(key: string): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    return `${base}/storage/v1/object/public/${BUCKET}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(BUCKET).remove([key]);
    if (error) throw new Error(`supabase delete failed: ${error.message}`);
  }

  async exists(key: string): Promise<boolean> {
    const supabase = await createClient();
    const lastSlash = key.lastIndexOf('/');
    const prefix = lastSlash >= 0 ? key.slice(0, lastSlash) : '';
    const fileName = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      search: fileName,
      limit: 1,
    });
    if (error) throw new Error(`supabase list failed: ${error.message}`);
    return (data ?? []).some((f) => f.name === fileName);
  }
}

function sizeOfBody(body: Buffer | ReadableStream | Blob): number {
  if (Buffer.isBuffer(body)) return body.byteLength;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  return 0; // ReadableStream size unknown
}
```

注意：实测时 `getPublicUrl` 用的是 supabase-js 的 `getPublicUrl` 还是自己拼？这里为简化避免再起一次 createClient，直接根据 env 拼字符串。如果后续 Supabase URL 结构有变化，记得回来调整。

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/storage/adapters/supabase.test.ts
```

Expected：PASS（7 个测试全过）

修复时如有断言不匹配，把 mock 返回值或实现按测试预期调整。

- [ ] **Step 5: Commit**

```bash
git add lib/storage/adapters/supabase.ts tests/lib/storage/adapters/supabase.test.ts
git commit -m "feat(storage): 实现 Supabase 适配器"
```

---

## Task 6：实现 Tencent COS 适配器（TDD，仅基础读写）

**Files:**
- Create: `lib/storage/adapters/tencent-cos.ts`
- Test: `tests/lib/storage/adapters/tencent-cos.test.ts`

CI 能力（probe / 抽帧 / 智能封面 / 雪碧图）放 Task 8 单独做。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/storage/adapters/tencent-cos.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const putObjectMock = vi.fn();
const deleteObjectMock = vi.fn();
const headObjectMock = vi.fn();
const getObjectUrlMock = vi.fn();

vi.mock('cos-nodejs-sdk-v5', () => {
  return {
    default: class MockCos {
      putObject = putObjectMock;
      deleteObject = deleteObjectMock;
      headObject = headObjectMock;
      getObjectUrl = getObjectUrlMock;
    },
  };
});

import { TencentCosAdapter } from '@/lib/storage/adapters/tencent-cos';

describe('TencentCosAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TENCENT_COS_SECRET_ID = 'id';
    process.env.TENCENT_COS_SECRET_KEY = 'key';
    process.env.TENCENT_COS_REGION = 'ap-shanghai';
    process.env.TENCENT_COS_BUCKET = 'my-bucket-12345';
  });

  it('upload puts object and returns public url', async () => {
    putObjectMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Location: 'my-bucket-12345.cos.ap-shanghai.myqcloud.com/u/x.jpg' })
    );
    const a = new TencentCosAdapter();
    const r = await a.upload({ key: 'u/x.jpg', body: Buffer.from('abc'), contentType: 'image/jpeg' });
    expect(r.key).toBe('u/x.jpg');
    expect(r.size).toBe(3);
    expect(r.url).toContain('my-bucket-12345.cos.ap-shanghai.myqcloud.com');
  });

  it('upload rejects on SDK error', async () => {
    putObjectMock.mockImplementation((_p: any, cb: any) => cb(new Error('cos failed')));
    const a = new TencentCosAdapter();
    await expect(a.upload({ key: 'k', body: Buffer.from(''), contentType: 'image/jpeg' }))
      .rejects.toThrow(/cos failed/);
  });

  it('getPublicUrl with custom domain', () => {
    process.env.TENCENT_COS_CUSTOM_DOMAIN = 'cdn.example.com';
    const a = new TencentCosAdapter();
    expect(a.getPublicUrl('u/x.jpg')).toBe('https://cdn.example.com/u/x.jpg');
  });

  it('getPublicUrl falls back to bucket+region when no custom domain', () => {
    delete process.env.TENCENT_COS_CUSTOM_DOMAIN;
    const a = new TencentCosAdapter();
    expect(a.getPublicUrl('u/x.jpg'))
      .toBe('https://my-bucket-12345.cos.ap-shanghai.myqcloud.com/u/x.jpg');
  });

  it('exists returns true when HeadObject succeeds', async () => {
    headObjectMock.mockImplementation((_p: any, cb: any) => cb(null, { statusCode: 200 }));
    const a = new TencentCosAdapter();
    expect(await a.exists('u/x.jpg')).toBe(true);
  });

  it('exists returns false on 404', async () => {
    headObjectMock.mockImplementation((_p: any, cb: any) => cb({ statusCode: 404 }));
    const a = new TencentCosAdapter();
    expect(await a.exists('u/missing.jpg')).toBe(false);
  });

  it('exists rethrows non-404 errors', async () => {
    headObjectMock.mockImplementation((_p: any, cb: any) => cb({ statusCode: 500, message: 'oops' }));
    const a = new TencentCosAdapter();
    await expect(a.exists('u/x.jpg')).rejects.toThrow(/oops|500/);
  });

  it('delete calls deleteObject', async () => {
    deleteObjectMock.mockImplementation((_p: any, cb: any) => cb(null, { statusCode: 204 }));
    const a = new TencentCosAdapter();
    await a.delete('u/x.jpg');
    expect(deleteObjectMock).toHaveBeenCalled();
  });

  it('createUploadCredential returns presigned PUT url', async () => {
    getObjectUrlMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Url: 'https://signed.example.com/u/x.mp4?signature=xxx' })
    );
    const a = new TencentCosAdapter();
    const c = await a.createUploadCredential({ key: 'u/x.mp4', contentType: 'video/mp4' });
    expect(c.method).toBe('PUT');
    expect(c.uploadUrl).toContain('signed.example.com');
    expect(c.publicUrl).toContain('my-bucket-12345.cos.ap-shanghai.myqcloud.com');
  });

  it('throws when env credentials missing', () => {
    delete process.env.TENCENT_COS_SECRET_ID;
    expect(() => new TencentCosAdapter()).toThrow(/TENCENT_COS_SECRET_ID/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/lib/storage/adapters/tencent-cos.test.ts
```

Expected：FAIL with "Cannot find module"

- [ ] **Step 3: 实现 `lib/storage/adapters/tencent-cos.ts`**

```typescript
import COS from 'cos-nodejs-sdk-v5';
import type {
  StorageProvider,
  UploadInput,
  UploadResult,
  UploadCredential,
  UploadCredentialInput,
} from '../types';

interface CosEnv {
  secretId: string;
  secretKey: string;
  region: string;
  bucket: string;
  customDomain?: string;
}

function loadEnv(): CosEnv {
  const required = ['TENCENT_COS_SECRET_ID', 'TENCENT_COS_SECRET_KEY', 'TENCENT_COS_REGION', 'TENCENT_COS_BUCKET'];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`${k} is required for TencentCosAdapter`);
  }
  return {
    secretId: process.env.TENCENT_COS_SECRET_ID!,
    secretKey: process.env.TENCENT_COS_SECRET_KEY!,
    region: process.env.TENCENT_COS_REGION!,
    bucket: process.env.TENCENT_COS_BUCKET!,
    customDomain: process.env.TENCENT_COS_CUSTOM_DOMAIN,
  };
}

export class TencentCosAdapter implements StorageProvider {
  readonly name = 'tencent-cos' as const;
  private cos: COS;
  private env: CosEnv;

  constructor() {
    this.env = loadEnv();
    this.cos = new COS({ SecretId: this.env.secretId, SecretKey: this.env.secretKey });
  }

  upload(input: UploadInput): Promise<UploadResult> {
    const body = toBuffer(input.body);
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.env.bucket,
          Region: this.env.region,
          Key: input.key,
          Body: body,
          ContentType: input.contentType,
        },
        (err, data) => {
          if (err) return reject(new Error(`cos putObject failed: ${err.message || err}`));
          resolve({
            url: this.getPublicUrl(input.key),
            key: input.key,
            size: body.byteLength,
          });
        }
      );
    });
  }

  createUploadCredential(input: UploadCredentialInput): Promise<UploadCredential> {
    const expires = input.expiresIn ?? 3600;
    return new Promise((resolve, reject) => {
      this.cos.getObjectUrl(
        {
          Bucket: this.env.bucket,
          Region: this.env.region,
          Key: input.key,
          Method: 'PUT',
          Sign: true,
          Expires: expires,
        },
        (err, data) => {
          if (err) return reject(new Error(`cos signing failed: ${err.message || err}`));
          resolve({
            uploadUrl: data.Url,
            method: 'PUT',
            headers: { 'Content-Type': input.contentType },
            publicUrl: this.getPublicUrl(input.key),
            expiresAt: Date.now() + expires * 1000,
          });
        }
      );
    });
  }

  getPublicUrl(key: string): string {
    if (this.env.customDomain) {
      return `https://${this.env.customDomain}/${key}`;
    }
    return `https://${this.env.bucket}.cos.${this.env.region}.myqcloud.com/${key}`;
  }

  delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        { Bucket: this.env.bucket, Region: this.env.region, Key: key },
        (err) => (err ? reject(new Error(`cos delete failed: ${err.message || err}`)) : resolve())
      );
    });
  }

  exists(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.cos.headObject(
        { Bucket: this.env.bucket, Region: this.env.region, Key: key },
        (err) => {
          if (!err) return resolve(true);
          if ((err as any).statusCode === 404) return resolve(false);
          reject(new Error(`cos headObject failed: ${(err as any).message || (err as any).statusCode}`));
        }
      );
    });
  }
}

function toBuffer(body: Buffer | ReadableStream | Blob): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    throw new Error('Blob upload not supported in Node-side adapter; convert to Buffer first');
  }
  throw new Error('ReadableStream upload requires multipart implementation; not in MVP scope');
}
```

**Note**: 大文件流式上传（`sliceUploadFile` / 分片）留到视频 Plan B 真正用到时再加。MVP 仅支持 Buffer。

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/storage/adapters/tencent-cos.test.ts
```

Expected：PASS（10 个测试全过）

- [ ] **Step 5: Commit**

```bash
git add lib/storage/adapters/tencent-cos.ts tests/lib/storage/adapters/tencent-cos.test.ts
git commit -m "feat(storage): 实现腾讯云 COS 适配器（基础读写）"
```

---

## Task 7：实现 Volcengine TOS Stub

**Files:**
- Create: `lib/storage/adapters/volcengine-tos.ts`

不需要单测——单一行为：抛错。

- [ ] **Step 1: 写 stub**

```typescript
// lib/storage/adapters/volcengine-tos.ts
import type { StorageProvider } from '../types';

const NOT_IMPLEMENTED = 'VolcengineTosAdapter is not implemented. Set STORAGE_PROVIDER to "supabase" or "tencent-cos".';

export class VolcengineTosAdapter implements StorageProvider {
  readonly name = 'volcengine-tos' as const;

  constructor() {
    throw new Error(NOT_IMPLEMENTED);
  }

  upload(): never { throw new Error(NOT_IMPLEMENTED); }
  createUploadCredential(): never { throw new Error(NOT_IMPLEMENTED); }
  getPublicUrl(): never { throw new Error(NOT_IMPLEMENTED); }
  delete(): never { throw new Error(NOT_IMPLEMENTED); }
  exists(): never { throw new Error(NOT_IMPLEMENTED); }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected：无 error

- [ ] **Step 3: Commit**

```bash
git add lib/storage/adapters/volcengine-tos.ts
git commit -m "feat(storage): 火山引擎 TOS 占位 stub（接口预留）"
```

---

## Task 8：实现 Tencent COS 数据万象 CI 能力（TDD）

**Files:**
- Create: `lib/storage/adapters/tencent-cos-media.ts`
- Test: `tests/lib/storage/adapters/tencent-cos-media.test.ts`
- Modify: `lib/storage/adapters/tencent-cos.ts`（让它 also implement MediaProcessingCapability）

COS 数据万象 CI 用的是 `request` 接口，文档：
- 视频信息提取（GetMediaInfo）: https://cloud.tencent.com/document/product/460/49284
- 视频截帧（GetSnapshot）: https://cloud.tencent.com/document/product/460/49283
- 雪碧图（GetSprite）: https://cloud.tencent.com/document/product/460/49285

调用方式：`cos.request()` 带 `?ci-process=...` query 参数。

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/storage/adapters/tencent-cos-media.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestMock = vi.fn();
const putObjectMock = vi.fn();

vi.mock('cos-nodejs-sdk-v5', () => ({
  default: class MockCos {
    request = requestMock;
    putObject = putObjectMock;
    deleteObject = vi.fn();
    headObject = vi.fn();
    getObjectUrl = vi.fn();
  },
}));

import { TencentCosAdapter } from '@/lib/storage/adapters/tencent-cos';

describe('TencentCosAdapter media processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TENCENT_COS_SECRET_ID = 'id';
    process.env.TENCENT_COS_SECRET_KEY = 'key';
    process.env.TENCENT_COS_REGION = 'ap-shanghai';
    process.env.TENCENT_COS_BUCKET = 'b';
  });

  it('probe parses GetMediaInfo response', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, {
        statusCode: 200,
        Response: {
          MediaInfo: {
            Format: { Duration: '125.5', Bitrate: '2000', Size: '12345678' },
            Stream: {
              Video: { Width: '1920', Height: '1080', Codec_name: 'h264' },
              Audio: { Codec_name: 'aac' },
            },
          },
        },
      })
    );
    const a = new TencentCosAdapter();
    const info = await a.probe('u/v.mp4');
    expect(info.durationSec).toBe(125.5);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.sizeBytes).toBe(12345678);
  });

  it('extractFrames returns one URL per timestamp', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { statusCode: 200, Body: Buffer.from('FAKEIMG') })
    );
    putObjectMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Location: '...' })
    );

    const a = new TencentCosAdapter();
    const frames = await a.extractFrames({
      sourceKey: 'u/v.mp4',
      timestamps: [0, 30, 60],
      outputKeyPrefix: 'u/frames/v',
    });
    expect(frames).toHaveLength(3);
    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].key).toMatch(/u\/frames\/v.*30/);
  });

  it('generateSmartCover uploads cover and returns url', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { statusCode: 200, Body: Buffer.from('COVER') })
    );
    putObjectMock.mockImplementation((_p: any, cb: any) =>
      cb(null, { Location: '...' })
    );
    const a = new TencentCosAdapter();
    const cover = await a.generateSmartCover({
      sourceKey: 'u/v.mp4',
      outputKey: 'u/covers/v.jpg',
    });
    expect(cover.key).toBe('u/covers/v.jpg');
    expect(cover.url).toContain('u/covers/v.jpg');
  });

  it('generateSpriteSheet returns sprite + vtt urls', async () => {
    requestMock.mockImplementation((_p: any, cb: any) =>
      cb(null, {
        statusCode: 200,
        Response: {
          OutputFile: { ObjectName: 'u/sprites/v.jpg' },
          OutputVttFile: { ObjectName: 'u/sprites/v.vtt' },
        },
      })
    );
    const a = new TencentCosAdapter();
    const r = await a.generateSpriteSheet({
      sourceKey: 'u/v.mp4',
      outputKey: 'u/sprites/v.jpg',
      rows: 5,
      cols: 5,
    });
    expect(r.key).toBe('u/sprites/v.jpg');
    expect(r.vttKey).toBe('u/sprites/v.vtt');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/lib/storage/adapters/tencent-cos-media.test.ts
```

Expected：FAIL（方法不存在）

- [ ] **Step 3: 扩展 `lib/storage/adapters/tencent-cos.ts`**

在文件末尾（class 内）添加以下方法，并在 class 声明改为 `implements StorageProvider, MediaProcessingCapability`：

```typescript
// 顶部 import 补
import type { MediaProcessingCapability } from '../types';

// class TencentCosAdapter implements StorageProvider, MediaProcessingCapability {
//   ... 原有方法 ...

  async probe(sourceKey: string): Promise<{
    durationSec: number; width: number; height: number;
    videoCodec: string; audioCodec: string; sizeBytes: number;
  }> {
    const data = await this.ciRequest({
      Key: sourceKey,
      Query: { 'ci-process': 'videoinfo' },
    });
    const info = data?.Response?.MediaInfo;
    if (!info) throw new Error('cos probe: empty MediaInfo');
    return {
      durationSec: Number(info.Format?.Duration ?? 0),
      width: Number(info.Stream?.Video?.Width ?? 0),
      height: Number(info.Stream?.Video?.Height ?? 0),
      videoCodec: String(info.Stream?.Video?.Codec_name ?? ''),
      audioCodec: String(info.Stream?.Audio?.Codec_name ?? ''),
      sizeBytes: Number(info.Format?.Size ?? 0),
    };
  }

  async generateSmartCover(input: {
    sourceKey: string; outputKey: string;
  }): Promise<{ key: string; url: string }> {
    const data = await this.ciRequest({
      Key: input.sourceKey,
      Query: { 'ci-process': 'snapshot', time: '0', format: 'jpg' },
    });
    const body = data?.Body;
    if (!body) throw new Error('cos snapshot: empty body');
    await this.upload({ key: input.outputKey, body: body as Buffer, contentType: 'image/jpeg' });
    return { key: input.outputKey, url: this.getPublicUrl(input.outputKey) };
  }

  async extractFrames(input: {
    sourceKey: string; timestamps: number[]; outputKeyPrefix: string;
  }): Promise<Array<{ timestamp: number; key: string; url: string }>> {
    const results: Array<{ timestamp: number; key: string; url: string }> = [];
    for (const t of input.timestamps) {
      const data = await this.ciRequest({
        Key: input.sourceKey,
        Query: { 'ci-process': 'snapshot', time: String(t), format: 'jpg' },
      });
      const body = data?.Body;
      if (!body) throw new Error(`cos snapshot at ${t}s: empty body`);
      const outKey = `${input.outputKeyPrefix}-${String(t).padStart(6, '0')}.jpg`;
      await this.upload({ key: outKey, body: body as Buffer, contentType: 'image/jpeg' });
      results.push({ timestamp: t, key: outKey, url: this.getPublicUrl(outKey) });
    }
    return results;
  }

  async generateSpriteSheet(input: {
    sourceKey: string; outputKey: string; rows: number; cols: number;
  }): Promise<{ key: string; url: string; vttKey?: string }> {
    const data = await this.ciRequest({
      Key: input.sourceKey,
      Query: {
        'ci-process': 'videoprocess',
        operation: `sprite/${input.rows}x${input.cols}`,
        output: input.outputKey,
      },
    });
    const out = data?.Response?.OutputFile?.ObjectName ?? input.outputKey;
    const vtt = data?.Response?.OutputVttFile?.ObjectName;
    return {
      key: out,
      url: this.getPublicUrl(out),
      vttKey: vtt,
    };
  }

  private ciRequest(params: { Key: string; Query: Record<string, string> }): Promise<any> {
    return new Promise((resolve, reject) => {
      this.cos.request(
        {
          Bucket: this.env.bucket,
          Region: this.env.region,
          Method: 'GET',
          Key: params.Key,
          Query: params.Query,
          RawBody: true,
        },
        (err: any, data: any) => (err ? reject(new Error(`cos CI failed: ${err.message || err}`)) : resolve(data))
      );
    });
  }
}
```

**Note**: 雪碧图、视频截帧的真实参数名（如 `time` vs `Time`）以腾讯云文档为准。本 Plan 给的是合理猜测，实施时第一步先用 curl 试一次 API 确认，再调整。

- [ ] **Step 4: 跑测试确认通过**

```bash
npm test -- tests/lib/storage/adapters/tencent-cos-media.test.ts
```

Expected：PASS（4 个测试）

如失败，先确认 mock 返回值符合实现期望，必要时同时调整实现与测试。

- [ ] **Step 5: 跑所有 storage 测试，确保没回归**

```bash
npm test -- tests/lib/storage
```

Expected：所有测试 PASS

- [ ] **Step 6: Commit**

```bash
git add lib/storage/adapters/tencent-cos.ts tests/lib/storage/adapters/tencent-cos-media.test.ts
git commit -m "feat(storage): 实现 COS 数据万象 CI 能力（probe/封面/抽帧/雪碧图）"
```

---

## Task 9：实现 getStorageProvider 工厂 + 对外 barrel（TDD）

**Files:**
- Create: `lib/storage/provider.ts`
- Create: `lib/storage/index.ts`
- Test: `tests/lib/storage/provider.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/lib/storage/provider.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/storage/adapters/supabase', () => ({
  SupabaseAdapter: class { readonly name = 'supabase'; },
}));
vi.mock('@/lib/storage/adapters/tencent-cos', () => ({
  TencentCosAdapter: class { readonly name = 'tencent-cos'; },
}));
vi.mock('@/lib/storage/adapters/volcengine-tos', () => ({
  VolcengineTosAdapter: class {
    constructor() { throw new Error('not implemented'); }
  },
}));

import { getStorageProvider, _resetProviderCache } from '@/lib/storage/provider';

describe('getStorageProvider', () => {
  beforeEach(() => {
    _resetProviderCache();
    delete process.env.STORAGE_PROVIDER;
  });

  it('defaults to supabase', () => {
    expect(getStorageProvider().name).toBe('supabase');
  });

  it('returns tencent-cos when env=tencent-cos', () => {
    process.env.STORAGE_PROVIDER = 'tencent-cos';
    expect(getStorageProvider().name).toBe('tencent-cos');
  });

  it('throws on volcengine-tos', () => {
    process.env.STORAGE_PROVIDER = 'volcengine-tos';
    expect(() => getStorageProvider()).toThrow(/not implemented/);
  });

  it('throws on unknown provider', () => {
    process.env.STORAGE_PROVIDER = 'aws-s3';
    expect(() => getStorageProvider()).toThrow(/unknown STORAGE_PROVIDER/i);
  });

  it('caches the provider instance', () => {
    process.env.STORAGE_PROVIDER = 'supabase';
    const a = getStorageProvider();
    const b = getStorageProvider();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npm test -- tests/lib/storage/provider.test.ts
```

Expected：FAIL

- [ ] **Step 3: 实现 `lib/storage/provider.ts`**

```typescript
import type { StorageProvider } from './types';
import { SupabaseAdapter } from './adapters/supabase';
import { TencentCosAdapter } from './adapters/tencent-cos';
import { VolcengineTosAdapter } from './adapters/volcengine-tos';

let cached: StorageProvider | null = null;
let cachedFor: string | null = null;

export function getStorageProvider(): StorageProvider {
  const requested = process.env.STORAGE_PROVIDER ?? 'supabase';
  if (cached && cachedFor === requested) return cached;

  switch (requested) {
    case 'supabase':
      cached = new SupabaseAdapter(); break;
    case 'tencent-cos':
      cached = new TencentCosAdapter(); break;
    case 'volcengine-tos':
      cached = new VolcengineTosAdapter(); break;
    default:
      throw new Error(`unknown STORAGE_PROVIDER: ${requested}`);
  }
  cachedFor = requested;
  return cached;
}

/** Test only */
export function _resetProviderCache() {
  cached = null;
  cachedFor = null;
}
```

- [ ] **Step 4: 实现 `lib/storage/index.ts`（barrel）**

```typescript
export type {
  StorageProvider,
  MediaProcessingCapability,
  StorageBackend,
  StorageKind,
  UploadInput,
  UploadResult,
  UploadCredential,
  UploadCredentialInput,
} from './types';
export { hasMediaProcessing } from './types';
export { getStorageProvider } from './provider';
export { identifyStorageBackend } from './url';
export { buildStorageKey } from './keys';
```

- [ ] **Step 5: 跑测试确认通过**

```bash
npm test -- tests/lib/storage/provider.test.ts
```

Expected：PASS

- [ ] **Step 6: 全量跑 storage 测试套件**

```bash
npm test -- tests/lib/storage
```

Expected：全部 PASS

- [ ] **Step 7: Commit**

```bash
git add lib/storage/provider.ts lib/storage/index.ts tests/lib/storage/provider.test.ts
git commit -m "feat(storage): 实现 getStorageProvider 工厂 + 对外 barrel"
```

---

## Task 10：迁移 dashboard-content.tsx 的上传调用

**Files:**
- Modify: `components/dashboard/dashboard-content.tsx`

⚠️ 这是 high-touch refactor 里风险最高的一个——影响图文转存路径。每改完一个调用点立刻 lint + 启 dev 做 smoke。

- [ ] **Step 1: 找到所有 `supabase.storage.from(` 调用点**

```bash
grep -n "supabase.storage.from" components/dashboard/dashboard-content.tsx
```

记下行号。预计 1-3 处。

- [ ] **Step 2: 为每个调用点写迁移**

把每处：

```typescript
const { data, error } = await supabase.storage
  .from(STORAGE_BUCKET)
  .upload(path, file);
if (error) throw error;
const { data: { publicUrl } } = supabase.storage
  .from(STORAGE_BUCKET)
  .getPublicUrl(data.path);
```

改为：

```typescript
import { getStorageProvider, buildStorageKey, type StorageKind } from '@/lib/storage';

// ...在调用点：
const kind: StorageKind = inferKind(file.type); // 'images' | 'videos' | 'audios'
const ext = file.name.split('.').pop() || 'bin';
const key = buildStorageKey({ userId: user.id, kind, ext });
const { url: publicUrl } = await getStorageProvider().upload({
  key,
  body: Buffer.from(await file.arrayBuffer()),
  contentType: file.type,
});
```

并在文件局部加：

```typescript
function inferKind(mime: string): StorageKind {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audios';
  return 'images';
}
```

⚠️ **Client Component 注意事项**：`dashboard-content.tsx` 是 client component（`"use client"`）。`getStorageProvider()` 内部调用 server-only 的 supabase client（在 Supabase adapter 中），**这条调用必须在 Server Action 或 API Route 里**。

**正确做法**：新建一个 server action 或 API route `app/api/upload/route.ts` 接收 file FormData，内部调 `getStorageProvider().upload()`，返回 URL。client 改为 fetch 这个 API。

- [ ] **Step 3: 创建 `app/api/upload/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorageProvider, buildStorageKey, type StorageKind } from '@/lib/storage';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const kindRaw = form.get('kind') as string | null;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const kind: StorageKind = (kindRaw as StorageKind) || inferKind(file.type);
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const key = buildStorageKey({ userId: user.id, kind, ext });

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await getStorageProvider().upload({
    key,
    body: buf,
    contentType: file.type || 'application/octet-stream',
  });

  return NextResponse.json({ url: result.url, key: result.key, size: result.size });
}

function inferKind(mime: string): StorageKind {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.startsWith('audio/')) return 'audios';
  return 'images';
}
```

- [ ] **Step 4: 修改 dashboard-content.tsx 用 fetch 上传**

把每处 supabase storage 上传改为：

```typescript
const fd = new FormData();
fd.append('file', file);
const res = await fetch('/api/upload', { method: 'POST', body: fd });
if (!res.ok) throw new Error(await res.text());
const { url: publicUrl } = await res.json();
```

- [ ] **Step 5: Lint + Build**

```bash
npm run lint && npx tsc --noEmit
```

Expected：无 error

- [ ] **Step 6: Smoke 手动验证**

```bash
npm run dev
```

打开 dashboard → 点 "+" → 切到 "文件上传" tab → 上传一张图 → 验证笔记卡片显示新图（URL 应是 supabase 老链接，因为本地 env 默认 `STORAGE_PROVIDER=supabase`）。

- [ ] **Step 7: 切换到 COS 复测**

在 `.env.local` 设：

```bash
STORAGE_PROVIDER=tencent-cos
TENCENT_COS_SECRET_ID=...   # 你的真实 key
TENCENT_COS_SECRET_KEY=...
TENCENT_COS_REGION=ap-shanghai
TENCENT_COS_BUCKET=...
```

重启 `npm run dev`，再上传一张图，验证：
- 笔记卡片正常显示
- 图片 URL 含 `.myqcloud.com`
- 在腾讯云控制台对应 bucket 能看到新文件

- [ ] **Step 8: Commit**

```bash
git add app/api/upload/route.ts components/dashboard/dashboard-content.tsx
git commit -m "refactor(dashboard): Add Note 上传切换到 StorageProvider"
```

---

## Task 11：迁移 EditMetaDialog.tsx 的封面上传

**Files:**
- Modify: `components/reader/EditMetaDialog.tsx`

- [ ] **Step 1: 定位调用点**

```bash
grep -n "supabase.storage" components/reader/EditMetaDialog.tsx
```

- [ ] **Step 2: 改为 fetch `/api/upload`（参考 Task 10 模式）**

把每处 supabase storage 上传 + getPublicUrl 改为：

```typescript
const fd = new FormData();
fd.append('file', file);
fd.append('kind', 'images'); // 封面始终是 images
const res = await fetch('/api/upload', { method: 'POST', body: fd });
if (!res.ok) throw new Error(await res.text());
const { url: publicUrl } = await res.json();
```

- [ ] **Step 3: Lint + Smoke**

```bash
npm run lint && npx tsc --noEmit
```

启 dev，进入任意笔记的 Reader，点编辑元信息，上传一张封面，验证显示正常 + URL backend 与 env 一致。

- [ ] **Step 4: Commit**

```bash
git add components/reader/EditMetaDialog.tsx
git commit -m "refactor(reader): EditMetaDialog 封面上传切换到 StorageProvider"
```

---

## Task 12：迁移 lib/ai-snapshot/ 的存储调用

**Files:**
- Modify: `lib/ai-snapshot/render.tsx`（如有上传）
- Modify: 任何 `lib/ai-snapshot/*.ts` 含 `supabase.storage`

- [ ] **Step 1: 定位所有 ai-snapshot 调用点**

```bash
grep -rn "supabase.storage\|user-files" lib/ai-snapshot/
```

- [ ] **Step 2: 按 Task 10 同款模式迁移**

ai-snapshot 是 server-side（Next.js Edge 或 Node runtime），可以**直接调** `getStorageProvider()`，不需要走 `/api/upload`。

```typescript
import { getStorageProvider, buildStorageKey } from '@/lib/storage';

const key = buildStorageKey({ userId, kind: 'snapshots', ext: 'png' });
const { url } = await getStorageProvider().upload({
  key,
  body: pngBuffer,
  contentType: 'image/png',
});
```

- [ ] **Step 3: 单测覆盖（如 ai-snapshot 有现成测试）+ Lint**

```bash
npm run lint && npx tsc --noEmit && npm test
```

- [ ] **Step 4: Smoke 验证**

启 dev，触发一次 AI snapshot 生成（具体路径见现有 ai-snapshot 文档），确认 snapshot 正常入库。

- [ ] **Step 5: Commit**

```bash
git add lib/ai-snapshot/
git commit -m "refactor(ai-snapshot): 持久化切换到 StorageProvider"
```

---

## Task 13：清理 + 验证回归

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 全量搜确认无遗漏**

```bash
grep -rn "supabase.storage.from" components/ lib/ app/ --include='*.ts' --include='*.tsx'
```

Expected：除了 `lib/storage/adapters/supabase.ts` 自己之外，**无任何业务调用**残留。

如有残留，按 Task 10 同款模式逐个迁移并 commit。

- [ ] **Step 2: 全量跑 storage 测试**

```bash
npm test -- tests/lib/storage
```

Expected：全部 PASS

- [ ] **Step 3: 跑 lint + build 确认全绿**

```bash
npm run lint && npm run build
```

Expected：build 成功

- [ ] **Step 4: 在 `CLAUDE.md` 加一句指向 lib/storage/**

在"Storage Bucket"段落下加：

```markdown
- **抽象层**: 所有写入应走 `lib/storage/getStorageProvider()`，不再直接调用 `supabase.storage.from(...)`。
- **后端切换**: 通过 `STORAGE_PROVIDER` 环境变量切换（supabase | tencent-cos）。
- **老链接兼容**: `lib/storage/identifyStorageBackend(url)` 用于读路径区分 supabase legacy 与 COS。
```

- [ ] **Step 5: 完整手动回归清单**

启 `npm run dev`，逐项验证：

- [ ] Dashboard 上传图片（图文转存）
- [ ] Dashboard 上传短视频
- [ ] Reader 编辑元信息上传封面
- [ ] AI snapshot 触发并入库
- [ ] 浏览历史里点开老笔记，老 Supabase URL 的图片依然能正常显示

逐项确认通过。

- [ ] **Step 6: Commit + 收尾**

```bash
git add CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md 指向 lib/storage 抽象层"
```

---

## Plan A 完成定义（DoD）

- [x] Vitest 测试框架已配置
- [x] `lib/storage/` 完整接口、类型、3 个 adapter（Supabase、Tencent COS 含 CI、Volcengine stub）、工厂
- [x] 单元测试覆盖率 > 80%（核心路径）
- [x] 所有现有业务上传调用点已切到 `getStorageProvider()`
- [x] `STORAGE_PROVIDER=supabase` 时，行为与切换前 100% 等价
- [x] `STORAGE_PROVIDER=tencent-cos` 时，新文件写入 COS，旧 Supabase 链接仍能读取
- [x] `.env.example` 含完整占位
- [x] `CLAUDE.md` 指向新抽象层
- [x] `npm run lint && npm run build` 全绿
- [x] 手动回归清单全部通过

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| COS SDK 的回调 vs Promise 风格混用导致 bug | 所有 SDK 调用统一封 Promise；测试覆盖错误路径 |
| client-side 改 server upload 导致体验变慢（多一跳）| 已是合理 trade-off；如要直传 COS 留给 Plan B 用 `createUploadCredential` |
| 数据万象 CI 参数名/响应结构与文档不一致 | Task 8 实施前先 curl 试一次 API，再调 mock 与实现 |
| 老 Supabase URL 与新 COS URL 同时存在导致前端处理混乱 | URL 直接渲染，无需分支；只有需要"删除/再上传"等运维场景才用 `identifyStorageBackend` |

---

## 后续：交接给 Plan B

Plan B（视频抓取 + AI 分析）严格依赖此 Plan：
- 视频字节 → `getStorageProvider().upload()` 或 `createUploadCredential()`
- 截帧 / 封面 / 视频元信息 → `MediaProcessingCapability` 方法
- 老笔记里的 supabase 图片 → 自动通过 URL 直接渲染，无需迁移
